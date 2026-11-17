import type { MessageParam, Tool } from '@anthropic-ai/sdk/resources/messages';
import {
  AGENT_MODEL,
  AiClient,
  SUBAGENT_MODEL,
  conversationPrompt,
} from 'src/ai-credential/ai-client';
import type { ModelUsage } from 'src/ai-credential/ai-usage.service';
import { runClaudeCode } from 'src/claude-code/claudeCode.runner';
import {
  BRIDGE_PREFIX,
  BRIDGE_SERVER,
  openBridge,
} from 'src/claude-code/mcpBridge';
import { runApiAgent } from './apiAgent';

/**
 * Opus para quem decide e escreve (o Jarvis e os agentes "principais"); Sonnet
 * para quem executa. Os nomes reais são os escolhidos em Definições → IA.
 */
export { AGENT_MODEL, SUBAGENT_MODEL };

/** Quanto o modelo pensa antes de responder. Menos esforço, menos uso. */
export type AgentEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Tool.InputSchema;
  handler: (input: any) => Promise<string>;
}

export interface RunAgentResult {
  replyText: string;
  messages: MessageParam[];
}

export interface RunAgentOptions {
  /**
   * Chamado quando o modelo decide usar uma ferramenta. É daqui que sai a linha
   * de estado que alimenta a constelação do Jarvis e o registo de atividade.
   */
  onToolUse?: (toolName: string, input: unknown) => void;

  /** Por omissão, o modelo do agente principal. */
  model?: string;

  /** Por omissão 'medium' — chega para encaminhar e escrever. */
  effort?: AgentEffort;

  /** Os tokens de cada resposta do modelo (para o registo de uso). */
  onUsage?: (usage: ModelUsage) => void;

  /**
   * Outros servidores MCP desta corrida, ligados diretamente (ex.: o do TREK),
   * com as ferramentas que podem correr sem perguntar ("mcp__trek__*").
   */
  mcpServers?: Record<string, unknown>;
  allowedTools?: string[];
}

/**
 * Corre um agente no Claude Code (`claude -p`, com a subscrição): o prompt do
 * agente, a conversa e as ferramentas dele, servidas pela ponte MCP do
 * MyHomeLab (só estas, com as permissões já aplicadas). O ciclo das ferramentas
 * é o do Claude Code; aqui só se liga, se acompanha e se regista. Com a API da
 * Anthropic escolhida, o ciclo é o do `runApiAgent` (mesmo prompt e ferramentas).
 */
export async function runAgent(
  client: AiClient,
  systemPrompt: string,
  tools: AgentTool[],
  messages: MessageParam[],
  options: RunAgentOptions = {},
): Promise<RunAgentResult> {
  if (client.provider === 'CLAUDE_API') {
    return runApiAgent(client, systemPrompt, tools, messages, options);
  }
  const bridge = openBridge(tools);
  try {
    const result = await runClaudeCode({
      systemPrompt,
      prompt: conversationPrompt(messages),
      model: client.pick(options.model ?? AGENT_MODEL),
      effort: options.effort ?? 'medium',
      mcpServers: {
        ...(tools.length ? { [BRIDGE_SERVER]: bridge.server } : {}),
        ...options.mcpServers,
      },
      allowedTools: [
        ...(tools.length ? [`${BRIDGE_PREFIX}*`] : []),
        ...(options.allowedTools ?? []),
      ],
      token: client.token,
      onToolUse: (name, input) =>
        options.onToolUse?.(
          name.startsWith(BRIDGE_PREFIX)
            ? name.slice(BRIDGE_PREFIX.length)
            : name,
          input,
        ),
    });
    for (const entry of result.usage) {
      options.onUsage?.({
        input: entry.fresh + entry.cacheRead + entry.cacheWrite,
        output: entry.output,
        model: entry.model,
        fresh: entry.fresh,
        cacheRead: entry.cacheRead,
        cacheWrite: entry.cacheWrite,
      });
    }
    return {
      replyText: result.text,
      messages: [...messages, { role: 'assistant', content: result.text }],
    };
  } finally {
    bridge.close();
  }
}
