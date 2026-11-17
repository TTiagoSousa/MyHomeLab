import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import type {
  ContentBlock,
  Message,
  MessageCreateParamsNonStreaming,
  Tool,
} from '@anthropic-ai/sdk/resources/messages';
import { AGENT_MODEL, AiClient, AiModels, SUBAGENT_MODEL } from './ai-client';

// A IA pela API da Anthropic, com a chave do utilizador (paga ao uso). Tem a mesma forma do
// cliente do Claude Code: `messages.create` para os pedidos de uma vez só, e o `runAgent`
// (assistant/apiAgent.ts) faz o ciclo das ferramentas dos agentes.

/** Os pedidos de uma vez só que não dizem o esforço vão com pouco, como no Claude Code. */
const DEFAULT_EFFORT = 'low';

// As saídas estruturadas não aceitam limites de tamanho nem de valor: tiram-se (o resto do
// esquema fica) e fecham-se os objetos, como elas pedem.
const UNSUPPORTED_KEYWORDS = new Set([
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minItems',
  'maxItems',
  'uniqueItems',
  'pattern',
  'format',
  'default',
]);

export function structuredSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(structuredSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (UNSUPPORTED_KEYWORDS.has(key)) continue;
    result[key] =
      key === 'properties' && value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(
              ([name, item]) => [name, structuredSchema(item)],
            ),
          )
        : structuredSchema(value);
  }
  if (result.type === 'object') result.additionalProperties = false;
  return result;
}

const textOf = (message: Message) =>
  message.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim();

const withInstruction = (
  system: MessageCreateParamsNonStreaming['system'],
  instruction: string,
): MessageCreateParamsNonStreaming['system'] =>
  typeof system === 'string' || !system
    ? `${system ?? ''}\n\n${instruction}`.trim()
    : [...system, { type: 'text', text: instruction }];

export function createApiClient(apiKey: string, models: AiModels): AiClient {
  const anthropic = new Anthropic({ apiKey, maxRetries: 3 });
  const pick = (model: string) =>
    model === AGENT_MODEL
      ? models.main
      : model === SUBAGENT_MODEL
        ? models.agent
        : model;

  // Sempre em stream: com max_tokens grande o SDK recusa pedidos sem stream (o tempo limite).
  const send = (params: MessageCreateParamsNonStreaming) =>
    anthropic.messages
      .stream({
        ...params,
        model: pick(params.model),
        output_config: {
          ...params.output_config,
          effort: params.output_config?.effort ?? DEFAULT_EFFORT,
        },
      })
      .finalMessage();

  return {
    provider: 'CLAUDE_API',
    token: null,
    anthropic,
    models,
    pick,
    messages: {
      /**
       * Os modelos 5.5 recusam o tool_choice forçado: quem pede uma ferramenta à força
       * (para ter JSON de volta) recebe a resposta das saídas estruturadas na forma de um
       * tool_use, como antes. Se o esquema não servir às saídas estruturadas, vai a
       * ferramenta com tool_choice auto e a instrução de a usar.
       */
      async create(params) {
        const choice = params.tool_choice;
        const forced =
          choice && choice.type === 'tool'
            ? (params.tools?.find(
                (tool) => 'input_schema' in tool && tool.name === choice.name,
              ) as Tool | undefined)
            : undefined;
        if (!forced) return send(params);

        const { tools: _tools, tool_choice: _choice, ...rest } = params;
        void _tools;
        void _choice;
        try {
          const message = await send({
            ...rest,
            output_config: {
              ...rest.output_config,
              format: {
                type: 'json_schema',
                schema: structuredSchema(forced.input_schema) as Record<
                  string,
                  unknown
                >,
              },
            },
          });
          const input = JSON.parse(textOf(message)) as unknown;
          const content: ContentBlock[] = [
            {
              type: 'tool_use',
              id: `toolu_${randomUUID()}`,
              name: forced.name,
              input,
            } as ContentBlock,
          ];
          return { ...message, content, stop_reason: 'tool_use' };
        } catch (error) {
          if (
            !(error instanceof Anthropic.BadRequestError) &&
            !(error instanceof SyntaxError)
          ) {
            throw error;
          }
        }
        return send({
          ...rest,
          system: withInstruction(
            rest.system,
            `Responde só com uma chamada à ferramenta ${forced.name}.`,
          ),
          tools: [forced],
          tool_choice: { type: 'auto' },
        });
      },
    },
  };
}

/** Um pedido mínimo para ver se a chave funciona (Haiku, pouco esforço). */
export async function testApiKey(apiKey: string): Promise<void> {
  const anthropic = new Anthropic({ apiKey, maxRetries: 1 });
  await anthropic.messages.create({
    model: 'claude-haiku-5-5',
    max_tokens: 16,
    output_config: { effort: 'low' },
    messages: [{ role: 'user', content: 'Responde só "ok".' }],
  });
}
