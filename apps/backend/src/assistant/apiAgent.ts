import Anthropic from '@anthropic-ai/sdk';
import type {
  Message,
  MessageParam,
  Tool,
  ToolResultBlockParam,
  ToolUseBlock,
} from '@anthropic-ai/sdk/resources/messages';
import { AGENT_MODEL, AiClient } from 'src/ai-credential/ai-client';
import type {
  AgentTool,
  RunAgentOptions,
  RunAgentResult,
} from './claude-agent.client';

/** Quantas voltas de ferramentas um agente dá antes de ter de responder. */
const MAX_TURNS = 40;
/** Os pedidos dos agentes vão em stream: com este máximo, sem stream o SDK recusa-os. */
const MAX_TOKENS = 64000;
/** O que volta de uma ferramenta, no máximo (o resto corta-se com um aviso). */
const MAX_RESULT_CHARS = 100_000;
const JSON_RETRIES = 2;

const textOf = (message: Message) =>
  message.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim();

const clip = (text: string) =>
  text.length > MAX_RESULT_CHARS
    ? `${text.slice(0, MAX_RESULT_CHARS)}\n\n[… cortado: a resposta tinha ${text.length} caracteres]`
    : text;

/**
 * Corre um agente pela API da Anthropic: o mesmo prompt, a mesma conversa e as mesmas
 * ferramentas (já com as permissões aplicadas) que no Claude Code, mas o ciclo das
 * ferramentas é este. O prompt e as ferramentas vão em cache, que se repetem a cada volta.
 * Os servidores MCP diretos (ex.: o do TREK) não existem aqui: ficam as ferramentas do
 * MyHomeLab que fazem o mesmo.
 */
export async function runApiAgent(
  client: AiClient,
  systemPrompt: string,
  tools: AgentTool[],
  messages: MessageParam[],
  options: RunAgentOptions = {},
): Promise<RunAgentResult> {
  const anthropic = client.anthropic;
  if (!anthropic) throw new Error('A API da Anthropic não está configurada.');

  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const apiTools: Tool[] = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
  const conversation: MessageParam[] = [...messages];
  const replies: string[] = [];
  let jsonRetries = 0;

  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    let message: Message;
    try {
      message = await anthropic.messages
        .stream({
          model: client.pick(options.model ?? AGENT_MODEL),
          max_tokens: MAX_TOKENS,
          system: [
            {
              type: 'text',
              text: systemPrompt,
              cache_control: { type: 'ephemeral' },
            },
          ],
          output_config: { effort: options.effort ?? 'medium' },
          ...(apiTools.length ? { tools: apiTools } : {}),
          messages: conversation,
        })
        .finalMessage();
      jsonRetries = 0;
    } catch (error) {
      // Só se repete uma ferramenta que veio com JSON partido; os erros da API sobem.
      if (error instanceof Anthropic.APIError || jsonRetries >= JSON_RETRIES) {
        throw error;
      }
      jsonRetries += 1;
      continue;
    }

    const usage = message.usage;
    options.onUsage?.({
      input:
        usage.input_tokens +
        (usage.cache_read_input_tokens ?? 0) +
        (usage.cache_creation_input_tokens ?? 0),
      output: usage.output_tokens,
      model: message.model,
      fresh: usage.input_tokens,
      cacheRead: usage.cache_read_input_tokens ?? 0,
      cacheWrite: usage.cache_creation_input_tokens ?? 0,
    });

    const text = textOf(message);
    if (text) replies.push(text);
    conversation.push({ role: 'assistant', content: message.content });

    if (message.stop_reason === 'pause_turn') continue;
    const calls = message.content.filter(
      (block): block is ToolUseBlock => block.type === 'tool_use',
    );
    // Uma recusa ou um corte em max_tokens podem deixar uma ferramenta a meio: não corre.
    if (
      !calls.length ||
      message.stop_reason === 'refusal' ||
      message.stop_reason === 'max_tokens'
    ) {
      break;
    }

    const results: ToolResultBlockParam[] = [];
    for (const call of calls) {
      const tool = byName.get(call.name);
      options.onToolUse?.(call.name, call.input);
      if (!tool) {
        results.push({
          type: 'tool_result',
          tool_use_id: call.id,
          is_error: true,
          content: `A ferramenta ${call.name} não existe para este agente.`,
        });
        continue;
      }
      try {
        results.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: clip(await tool.handler(call.input)),
        });
      } catch (error) {
        results.push({
          type: 'tool_result',
          tool_use_id: call.id,
          is_error: true,
          content: error instanceof Error ? error.message : String(error),
        });
      }
    }
    conversation.push({ role: 'user', content: results });
  }

  const replyText = replies.at(-1) ?? '';
  return {
    replyText,
    messages: [...messages, { role: 'assistant', content: replyText }],
  };
}
