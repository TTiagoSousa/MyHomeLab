#!/usr/bin/env node
// O terminal do MyHomeLab: o Claude Code limpo (sem as definições, skills, plugins,
// CLAUDE.md nem as ferramentas dele), ligado ao MyHomeLab que corre nesta máquina —
// os documentos e o TREK (só a ler) — com a subscrição do Claude.
//
//   npm run claude
//
// MYHOMELAB_API (por omissão http://127.0.0.1:3100) e CLAUDE_BIN mudam o backend e o
// executável. O token do terminal fica em apps/backend/.claude-terminal-token (fora do git).
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tokenFile =
  process.env.CLAUDE_TERMINAL_TOKEN_FILE ?? join(root, 'apps', 'backend', '.claude-terminal-token');
const api = process.env.MYHOMELAB_API ?? 'http://127.0.0.1:3100';

const fail = (message) => {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
};

function claudeBin() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  if (process.platform === 'win32' && process.env.APPDATA) {
    const exe = join(process.env.APPDATA, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
    if (existsSync(exe)) return exe;
  }
  return 'claude';
}

if (!existsSync(tokenFile)) {
  writeFileSync(tokenFile, randomBytes(48).toString('hex'), { mode: 0o600 });
}
const token = readFileSync(tokenFile, 'utf8').trim();

let session;
try {
  const response = await fetch(`${api}/internal/terminal/session`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    fail(
      response.status === 403
        ? 'O backend recusou o terminal (o token ou o endereço). Corre isto na mesma máquina do backend.'
        : response.status === 404
          ? 'Este backend ainda não tem o terminal: reinicia-o com o código novo.'
          : `O backend respondeu ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }
  session = await response.json();
} catch (error) {
  if (session) throw error;
  fail(`Não consegui falar com o MyHomeLab em ${api}. O backend está a correr? (npm run dev:backend)`);
}

const dir = mkdtempSync(join(tmpdir(), 'mhl-terminal-'));
const mcpFile = join(dir, 'mcp.json');
const systemFile = join(dir, 'system.txt');
writeFileSync(mcpFile, JSON.stringify({ mcpServers: session.mcpServers }));
writeFileSync(systemFile, session.systemPrompt);

const env = { ...process.env, DISABLE_AUTOUPDATER: '1' };
// A chave da API passava à frente da subscrição.
delete env.ANTHROPIC_API_KEY;
delete env.ANTHROPIC_AUTH_TOKEN;

console.log(`\nMyHomeLab · terminal (${session.user}) · ${session.model}`);
console.log('Só os documentos e o TREK a ler. Para sair: Ctrl+C duas vezes.\n');

const child = spawn(
  claudeBin(),
  [
    '--strict-mcp-config',
    '--mcp-config',
    mcpFile,
    '--setting-sources',
    '',
    '--disable-slash-commands',
    '--tools',
    '',
    '--allowedTools',
    session.allowedTools.join(','),
    '--permission-mode',
    'dontAsk',
    '--system-prompt-file',
    systemFile,
    '--model',
    session.model,
  ],
  { cwd: dir, env, stdio: 'inherit', windowsHide: false },
);
const cleanUp = () => rmSync(dir, { recursive: true, force: true });
child.on('error', (error) => {
  cleanUp();
  fail(error.code === 'ENOENT' ? 'O Claude Code não está instalado (npm install -g @anthropic-ai/claude-code).' : error.message);
});
child.on('exit', (code) => {
  cleanUp();
  process.exit(code ?? 0);
});
