import { randomUUID } from 'crypto';
import type Anthropic from '@anthropic-ai/sdk';
import type {
  ContentBlock,
  Message,
  MessageCreateParamsNonStreaming,
  MessageParam,
} from '@anthropic-ai/sdk/resources/messages';
import {
  ClaudeCodeFile,
  ClaudeCodeUsage,
  runClaudeCode,
} from 'src/claude-code/claudeCode.runner';

/** O código pede "o modelo principal" ou "o dos agentes"; estes nomes viram os escolhidos. */
export const AGENT_MODEL = 'claude-opus-5-5';
export const SUBAGENT_MODEL = 'claude-sonnet-5-5';

export interface AiModels {
  /** O do Jarvis e dos agentes marcados como "principal" (Opus). */
  main: string;
  /** O dos outros agentes e das tarefas simples (Sonnet). */
  agent: string;
}

export const DEFAULT_MODELS: AiModels = {
  main: AGENT_MODEL,
  agent: SUBAGENT_MODEL,
};

/** Os modelos que a subscrição deixa usar no Claude Code. */
export const CLAUDE_CODE_MODELS = [
  'claude-opus-5-5',
  'claude-sonnet-5-5',
  'claude-haiku-5-5',
  'claude-fable-5-2',
];

export type AiProviderKind = 'CLAUDE_CODE' | 'CLAUDE_API';

/** A vez no Claude Code: por utilizador, no máximo `max` trabalhos ao mesmo tempo. */
export interface ClaudeCodeTurn {
  key: string;
  max: number;
}

/**
 * A IA de um utilizador: o Claude Code desta máquina, com a subscrição dele, ou a API da
 * Anthropic, com a chave dele.
 * Mantém a forma do cliente da Anthropic (`messages.create`) para as funções de
 * um pedido só (regras de email, refeições, análises); os agentes com
 * ferramentas correm pelo `runAgent`, que usa o `token` e os `models` daqui.
 */
export interface AiClient {
  provider: AiProviderKind;
  /** Claude Code: o token da subscrição (claude setup-token); null = o login da máquina. */
  token: string | null;
  /** API: o cliente da Anthropic com a chave do utilizador. */
  anthropic?: Anthropic;
  models: AiModels;
  pick: (model: string) => string;
  /** Claude Code: a fila dos trabalhos deste utilizador (claudeCodeQueue). */
  turn?: ClaudeCodeTurn;
  /** Modo Misto: a IA dos subagentes, quando é outra (sem ele, a mesma). */
  delegate?: AiClient;
  messages: {
    create(params: MessageCreateParamsNonStreaming): Promise<Message>;
  };
}

const textOf = (content: MessageParam['content']): string =>
  typeof content === 'string'
    ? content
    : content
        .map((block) =>
          block.type === 'text'
            ? block.text
            : block.type === 'tool_result'
              ? typeof block.content === 'string'
                ? block.content
                : ''
              : '',
        )
        .filter(Boolean)
        .join('\n');

/**
 * Uma conversa (o histórico que o MyHomeLab guarda) num pedido só: o Claude
 * Code começa sempre do zero, por isso o histórico vai escrito antes do pedido.
 */
export function conversationPrompt(messages: MessageParam[]): string {
  const turns = messages
    .map((message) => ({
      role: message.role,
      text: textOf(message.content).trim(),
    }))
    .filter((turn) => turn.text);
  const lastUser = turns.map((turn) => turn.role).lastIndexOf('user');
  if (lastUser <= 0 && turns.length <= 1) return turns[0]?.text ?? '';
  const label = (role: string) =>
    role === 'user'
      ? 'Utilizador'
      : role === 'assistant'
        ? 'Tu'
        : 'Nota do sistema';
  const history = turns
    .slice(0, lastUser)
    .map((turn) => `[${label(turn.role)}]\n${turn.text}`)
    .join('\n\n');
  const after = turns
    .slice(lastUser + 1)
    .map((turn) => `[${label(turn.role)}]\n${turn.text}`)
    .join('\n\n');
  return [
    history ? `CONVERSA ATÉ AGORA:\n\n${history}` : null,
    `PEDIDO ATUAL (responde a este):\n\n${turns[lastUser]?.text ?? ''}`,
    after || null,
  ]
    .filter(Boolean)
    .join('\n\n---\n\n');
}

/** Os PDF e as imagens que vêm nas mensagens, como ficheiros para o modelo ler. */
export function filesOf(messages: MessageParam[]): ClaudeCodeFile[] {
  const files: ClaudeCodeFile[] = [];
  for (const message of messages) {
    if (typeof message.content === 'string') continue;
    for (const block of message.content) {
      if (
        (block.type === 'document' || block.type === 'image') &&
        block.source.type === 'base64'
      ) {
        const extension =
          block.type === 'document'
            ? 'pdf'
            : (block.source.media_type.split('/')[1] ?? 'png');
        // O PDF vai com o nome dele (o title), para o prompt e o ficheiro baterem certo.
        const title =
          block.type === 'document' && block.title
            ? block.title.replace(/[^\w.\- ]+/g, '_').replace(/\.pdf$/i, '')
            : null;
        files.push({
          name: title
            ? `${files.length + 1}-${title}.pdf`
            : `${block.type}-${files.length + 1}.${extension}`,
          data: Buffer.from(block.source.data, 'base64'),
        });
      }
    }
  }
  return files;
}

const systemOf = (system: MessageCreateParamsNonStreaming['system']) =>
  typeof system === 'string'
    ? system
    : (system ?? []).map((block) => block.text).join('\n\n');

/** Os tokens de várias respostas somados, na forma da API (para quem os regista). */
export function usageTotal(usage: ClaudeCodeUsage[]) {
  return usage.reduce(
    (total, entry) => ({
      input_tokens: total.input_tokens + entry.fresh,
      output_tokens: total.output_tokens + entry.output,
      cache_read_input_tokens: total.cache_read_input_tokens + entry.cacheRead,
      cache_creation_input_tokens:
        total.cache_creation_input_tokens + entry.cacheWrite,
    }),
    {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
  );
}

export function createAiClient(
  token: string | null,
  models: AiModels,
  turn?: ClaudeCodeTurn,
): AiClient {
  const pick = (model: string) =>
    model === AGENT_MODEL
      ? models.main
      : model === SUBAGENT_MODEL
        ? models.agent
        : model;

  return {
    provider: 'CLAUDE_CODE',
    token,
    models,
    pick,
    turn,
    messages: {
      async create(params) {
        const choice = params.tool_choice;
        const forced =
          choice && choice.type === 'tool'
            ? params.tools?.find(
                (tool) => 'input_schema' in tool && tool.name === choice.name,
              )
            : undefined;
        const model = pick(params.model);
        const result = await runClaudeCode({
          systemPrompt: systemOf(params.system),
          prompt: conversationPrompt(params.messages),
          model,
          effort: params.output_config?.effort ?? 'low',
          jsonSchema:
            forced && 'input_schema' in forced
              ? forced.input_schema
              : undefined,
          files: filesOf(params.messages),
          token,
        });
        const content: ContentBlock[] =
          forced && result.structured
            ? [
                {
                  type: 'tool_use',
                  id: `toolu_${randomUUID()}`,
                  name: forced.name,
                  input: result.structured,
                } as ContentBlock,
              ]
            : [
                {
                  type: 'text',
                  text: result.text,
                  citations: null,
                },
              ];
        return {
          id: `msg_${randomUUID()}`,
          type: 'message',
          role: 'assistant',
          model: result.usage[0]?.model ?? model,
          content,
          stop_reason: forced ? 'tool_use' : 'end_turn',
          stop_sequence: null,
          usage: usageTotal(result.usage),
        } as unknown as Message;
      },
    },
  };
}
