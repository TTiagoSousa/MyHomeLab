import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Quando falta memória, o kernel mata primeiro este processo do Claude Code em vez
 * do backend: falha só esse pedido (com o erro gravado) e o resto do site continua.
 * Subir o próprio valor não precisa de privilégios; fora do Linux não faz nada.
 */
function firstToGo(pid: number | undefined) {
  if (!pid || process.platform !== 'linux') return;
  writeFile(`/proc/${pid}/oom_score_adj`, '1000').catch(() => undefined);
}

/** Os tokens de uma resposta do modelo, como o Claude Code os conta. */
export interface ClaudeCodeUsage {
  model: string;
  fresh: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface ClaudeCodeFile {
  name: string;
  data: Buffer;
}

export interface ClaudeCodeRunOptions {
  systemPrompt: string;
  /** O pedido (vai pelo stdin, sem limites de tamanho nem aspas). */
  prompt: string;
  model: string;
  effort?: string;
  /** Os servidores MCP desta corrida ({ nome: { type, url, headers } }). */
  mcpServers?: Record<string, unknown>;
  /** As ferramentas permitidas sem perguntar (ex.: "mcp__myhomelab__*"). */
  allowedTools?: string[];
  /** Pede a resposta neste formato (vem em `structured`). */
  jsonSchema?: object;
  /** Ficheiros (PDF, imagens) que o modelo pode ler, e só esses. */
  files?: ClaudeCodeFile[];
  timeoutMs?: number;
  onToolUse?: (name: string, input: unknown) => void;
  /** O token da subscrição (CLAUDE_CODE_OAUTH_TOKEN); sem ele, o login da máquina. */
  token?: string | null;
}

export interface ClaudeCodeResult {
  text: string;
  structured: unknown;
  usage: ClaudeCodeUsage[];
  /** O custo que teria na API (o Claude Code calcula-o); não é faturado. */
  costUsd: number;
}

export type ClaudeCodeErrorCode =
  'NOT_INSTALLED' | 'NOT_LOGGED_IN' | 'LIMIT' | 'TIMEOUT' | 'FAILED';

export class ClaudeCodeError extends Error {
  constructor(
    readonly code: ClaudeCodeErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const DEFAULT_TIMEOUT_MS = 20 * 60_000;

/**
 * O executável do Claude Code: CLAUDE_BIN, ou (no Windows) o binário que o npm
 * instala por trás do claude.cmd — o .cmd não se lança sem shell, e com shell as
 * aspas dos argumentos partem-se. No Linux, o `claude` do PATH.
 */
export function claudeBin(): string {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  if (process.platform === 'win32' && process.env.APPDATA) {
    const exe = join(
      process.env.APPDATA,
      'npm',
      'node_modules',
      '@anthropic-ai',
      'claude-code',
      'bin',
      'claude.exe',
    );
    if (existsSync(exe)) return exe;
  }
  return 'claude';
}

/**
 * O ambiente do processo: só o necessário. Nunca a chave da API (no modo -p
 * passava à frente da subscrição) nem os segredos do MyHomeLab (.env).
 */
function cleanEnv(token?: string | null): NodeJS.ProcessEnv {
  const keep = [
    'PATH',
    'HOME',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
    'SYSTEMROOT',
    'TEMP',
    'TMP',
    'LANG',
    'HTTPS_PROXY',
    'HTTP_PROXY',
    'NO_PROXY',
  ];
  const env: NodeJS.ProcessEnv = {};
  for (const key of keep) if (process.env[key]) env[key] = process.env[key];
  // As ferramentas do MyHomeLab podem demorar (um subagente, um backup).
  env.MCP_TOOL_TIMEOUT = String(DEFAULT_TIMEOUT_MS);
  env.DISABLE_AUTOUPDATER = '1';
  env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1';
  if (token) env.CLAUDE_CODE_OAUTH_TOKEN = token;
  return env;
}

/** O que interessa dos eventos do `--output-format stream-json`. */
interface StreamUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

interface StreamEvent {
  type?: string;
  status?: string;
  rate_limit_info?: { status?: string };
  message?: {
    id?: string;
    model?: string;
    usage?: StreamUsage;
    content?: { type?: string; name?: string; input?: unknown }[];
  };
  is_error?: boolean;
  subtype?: string;
  result?: unknown;
  structured_output?: unknown;
  total_cost_usd?: number;
  modelUsage?: Record<string, ModelUsage>;
}

interface ModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
}

// Os totais finais da corrida, por modelo. As mensagens do stream trazem a saída
// ainda a meio (muitas vezes 1 token), por isso só servem de recurso.
const finalUsage = (modelUsage: Record<string, ModelUsage>) =>
  Object.entries(modelUsage).map(([model, usage]) => ({
    model,
    fresh: usage.inputTokens ?? 0,
    output: usage.outputTokens ?? 0,
    cacheRead: usage.cacheReadInputTokens ?? 0,
    cacheWrite: usage.cacheCreationInputTokens ?? 0,
  }));

const usageOf = (model: string, usage: StreamUsage) => ({
  model,
  fresh: usage.input_tokens ?? 0,
  output: usage.output_tokens ?? 0,
  cacheRead: usage.cache_read_input_tokens ?? 0,
  cacheWrite: usage.cache_creation_input_tokens ?? 0,
});

function classify(text: string): ClaudeCodeErrorCode {
  if (
    /not logged in|please run \/login|invalid api key|oauth|authentication/i.test(
      text,
    )
  )
    return 'NOT_LOGGED_IN';
  if (/usage limit|rate limit|limit reached|out of extra usage/i.test(text))
    return 'LIMIT';
  return 'FAILED';
}

/**
 * Uma corrida do Claude Code sem interface (`claude -p`), limpa: sem as
 * definições, skills, plugins ou CLAUDE.md da máquina, sem as ferramentas dele
 * (Bash, ficheiros, web) — só os MCP que lhe passamos e, com ficheiros, ler
 * esses ficheiros. Corre numa pasta temporária, apagada no fim.
 */
export async function runClaudeCode(
  options: ClaudeCodeRunOptions,
): Promise<ClaudeCodeResult> {
  const dir = await mkdtemp(join(tmpdir(), 'mhl-claude-'));
  try {
    const systemFile = join(dir, 'system.txt');
    await writeFile(systemFile, options.systemPrompt);
    const args = [
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--no-session-persistence',
      '--strict-mcp-config',
      '--setting-sources',
      '',
      '--disable-slash-commands',
      '--permission-mode',
      'dontAsk',
      '--system-prompt-file',
      systemFile,
      '--model',
      options.model,
    ];
    if (options.effort) args.push('--effort', options.effort);
    if (options.mcpServers && Object.keys(options.mcpServers).length) {
      const mcpFile = join(dir, 'mcp.json');
      await writeFile(
        mcpFile,
        JSON.stringify({ mcpServers: options.mcpServers }),
      );
      args.push('--mcp-config', mcpFile);
    }
    const allowed = [...(options.allowedTools ?? [])];
    if (options.files?.length) {
      const filesDir = join(dir, 'files');
      await mkdir(filesDir, { recursive: true });
      for (const file of options.files) {
        await writeFile(join(filesDir, file.name), file.data);
      }
      args.push('--tools', 'Read', '--add-dir', filesDir);
      allowed.push('Read');
    } else {
      args.push('--tools', '');
    }
    if (allowed.length) args.push('--allowedTools', allowed.join(','));
    if (options.jsonSchema)
      args.push('--json-schema', JSON.stringify(options.jsonSchema));

    const prompt = options.files?.length
      ? `${options.prompt}\n\nOs ficheiros estão em ${join(dir, 'files')}: ${options.files
          .map((file) => file.name)
          .join(', ')}. Lê-os com a ferramenta Read.`
      : options.prompt;

    return await new Promise<ClaudeCodeResult>((resolve, reject) => {
      const child = spawn(claudeBin(), args, {
        cwd: dir,
        env: cleanEnv(options.token),
        windowsHide: true,
      });
      firstToGo(child.pid);
      const usage: ClaudeCodeUsage[] = [];
      // O stream repete a mesma mensagem (uma vez por bloco): conta-se uma vez.
      const counted = new Set<string>();
      let buffer = '';
      let stderr = '';
      let result: StreamEvent | null = null;
      let limited = false;

      const timer = setTimeout(() => {
        child.kill();
        reject(
          new ClaudeCodeError('TIMEOUT', 'O Claude Code demorou demasiado.'),
        );
      }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

      const onEvent = (event: StreamEvent) => {
        if (event.type === 'assistant' && event.message) {
          const model = event.message.model ?? options.model;
          const id = String(event.message.id ?? usage.length);
          if (event.message.usage && !counted.has(id)) {
            counted.add(id);
            usage.push(usageOf(model, event.message.usage));
          }
          for (const block of event.message.content ?? []) {
            if (block.type === 'tool_use' && block.name)
              options.onToolUse?.(block.name, block.input);
          }
        } else if (event.type === 'rate_limit_event') {
          const status = event.rate_limit_info?.status ?? event.status;
          if (status && status !== 'allowed' && status !== 'allowed_warning')
            limited = true;
        } else if (event.type === 'result') {
          result = event;
        }
      };

      child.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        let newline = buffer.indexOf('\n');
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line) {
            try {
              onEvent(JSON.parse(line) as StreamEvent);
            } catch {
              // Uma linha que não é JSON (aviso) não estraga a corrida.
            }
          }
          newline = buffer.indexOf('\n');
        }
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });
      child.on('error', (error: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        reject(
          error.code === 'ENOENT'
            ? new ClaudeCodeError(
                'NOT_INSTALLED',
                'O Claude Code não está instalado nesta máquina (ou o CLAUDE_BIN está errado).',
              )
            : new ClaudeCodeError('FAILED', error.message),
        );
      });
      child.on('close', (exitCode) => {
        clearTimeout(timer);
        const done = result;
        if (done && !done.is_error) {
          resolve({
            text: typeof done.result === 'string' ? done.result : '',
            structured: done.structured_output ?? null,
            usage:
              done.modelUsage && Object.keys(done.modelUsage).length
                ? finalUsage(done.modelUsage)
                : usage,
            costUsd: Number(done.total_cost_usd ?? 0),
          });
          return;
        }
        const said =
          typeof done?.result === 'string' && done.result
            ? done.result
            : (done?.subtype ?? '');
        const detail = (said || stderr || `saiu com ${exitCode}`).slice(0, 500);
        const code = limited ? 'LIMIT' : classify(detail);
        reject(
          new ClaudeCodeError(
            code,
            code === 'LIMIT'
              ? `A subscrição do Claude chegou ao limite: ${detail}`
              : code === 'NOT_LOGGED_IN'
                ? `O Claude Code não tem sessão iniciada: ${detail}`
                : `O Claude Code falhou: ${detail}`,
          ),
        );
      });

      child.stdin.end(prompt);
    });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
