import type Anthropic from '@anthropic-ai/sdk';
import type { Message } from '@anthropic-ai/sdk/resources/messages';
import { AiClient, DEFAULT_MODELS } from 'src/ai-credential/ai-client';
import { structuredSchema } from 'src/ai-credential/claudeApiClient';
import { apiMessages, runApiAgent } from './apiAgent';

describe('apiMessages', () => {
  it('passa a nota "system" para texto marcado, junto da mensagem dele', () => {
    const messages = [
      { role: 'assistant', content: 'olá' },
      { role: 'user', content: 'aprovo' },
      { role: 'system', content: 'Há 1 proposta por decidir.' },
    ] as unknown as Parameters<typeof apiMessages>[0];
    expect(apiMessages(messages)).toEqual([
      { role: 'assistant', content: 'olá' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'aprovo' },
          {
            type: 'text',
            text: '[Nota do MyHomeLab]\nHá 1 proposta por decidir.',
          },
        ],
      },
    ]);
  });
});

const reply = (
  content: Message['content'],
  stop_reason: Message['stop_reason'],
): Message =>
  ({
    id: 'msg',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5-5',
    content,
    stop_reason,
    stop_sequence: null,
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      cache_read_input_tokens: 100,
      cache_creation_input_tokens: 0,
    },
  }) as unknown as Message;

const fakeClient = (answers: Message[]) => {
  const requests: unknown[] = [];
  const anthropic = {
    messages: {
      stream: (params: unknown) => {
        requests.push(JSON.parse(JSON.stringify(params)));
        const next = answers.shift();
        return { finalMessage: () => Promise.resolve(next) };
      },
    },
  } as unknown as Anthropic;
  const client: AiClient = {
    provider: 'CLAUDE_API',
    token: null,
    anthropic,
    models: DEFAULT_MODELS,
    pick: (model) => model,
    messages: { create: () => Promise.reject(new Error('não usado')) },
  };
  return { client, requests };
};

describe('runApiAgent', () => {
  it('corre a ferramenta, devolve o resultado e responde com o último texto', async () => {
    const { client, requests } = fakeClient([
      reply(
        [
          { type: 'text', text: 'Vou ver.', citations: null },
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'list_trips',
            input: { limit: 2 },
          } as never,
        ],
        'tool_use',
      ),
      reply(
        [{ type: 'text', text: 'Tens 2 viagens.', citations: null }],
        'end_turn',
      ),
    ]);
    const used: string[] = [];
    let usages = 0;
    const result = await runApiAgent(
      client,
      'És o agente de viagens.',
      [
        {
          name: 'list_trips',
          description: 'As viagens',
          inputSchema: { type: 'object', properties: {} },
          handler: (input: { limit: number }) =>
            Promise.resolve(`viagens: ${input.limit}`),
        },
      ],
      [{ role: 'user', content: 'Que viagens tenho?' }],
      { onToolUse: (name) => used.push(name), onUsage: () => (usages += 1) },
    );

    expect(result.replyText).toBe('Tens 2 viagens.');
    expect(used).toEqual(['list_trips']);
    expect(usages).toBe(2);
    const second = requests[1] as {
      messages: { role: string; content: unknown }[];
    };
    expect(second.messages.at(-1)).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'toolu_1', content: 'viagens: 2' },
      ],
    });
    const first = requests[0] as {
      system: { cache_control?: unknown }[];
      cache_control?: unknown;
    };
    expect(first.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(first.cache_control).toEqual({ type: 'ephemeral' });
  });

  it('uma ferramenta que falha volta como erro e o agente continua', async () => {
    const { client, requests } = fakeClient([
      reply(
        [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'quebra',
            input: {},
          } as never,
        ],
        'tool_use',
      ),
      reply([{ type: 'text', text: 'Falhou.', citations: null }], 'end_turn'),
    ]);
    await runApiAgent(
      client,
      'x',
      [
        {
          name: 'quebra',
          description: 'x',
          inputSchema: { type: 'object', properties: {} },
          handler: () => Promise.reject(new Error('sem rede')),
        },
      ],
      [{ role: 'user', content: 'faz' }],
    );
    const second = requests[1] as { messages: { content: unknown }[] };
    expect(second.messages.at(-1)?.content).toEqual([
      {
        type: 'tool_result',
        tool_use_id: 'toolu_1',
        is_error: true,
        content: 'sem rede',
      },
    ]);
  });
});

describe('structuredSchema', () => {
  it('fecha os objetos e tira os limites que as saídas estruturadas não aceitam', () => {
    expect(
      structuredSchema({
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 80, description: 'o nome' },
          items: {
            type: 'array',
            maxItems: 5,
            items: {
              type: 'object',
              properties: { n: { type: 'integer', minimum: 0 } },
            },
          },
        },
        required: ['name'],
      }),
    ).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', description: 'o nome' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: { n: { type: 'integer' } },
          },
        },
      },
      required: ['name'],
    });
  });
});
