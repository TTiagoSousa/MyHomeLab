import { handleBridge, openBridge, sendBridgeReply } from './mcpBridge';
import { conversationPrompt } from 'src/ai-credential/ai-client';

describe('a ponte MCP', () => {
  const tools = [
    {
      name: 'list_backups',
      description: 'Os backups.',
      inputSchema: { type: 'object' as const, properties: {} },
      handler: () => Promise.resolve('Forgejo: OK'),
    },
    {
      name: 'falha',
      description: 'Rebenta.',
      inputSchema: { type: 'object' as const, properties: {} },
      handler: () => Promise.reject(new Error('serviço em baixo')),
    },
  ];

  it('serve as ferramentas da corrida só com o token dela', async () => {
    const bridge = openBridge(tools);
    const id = String(bridge.server.url.split('/').pop());
    const auth = bridge.server.headers.Authorization;

    expect((await handleBridge(id, 'Bearer errado', {})).status).toBe(401);

    const list = await handleBridge(id, auth, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    });
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).toContain('list_backups');

    const call = await handleBridge(id, auth, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'list_backups', arguments: {} },
    });
    expect(JSON.stringify(call.body)).toContain('Forgejo: OK');

    const failed = await handleBridge(id, auth, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'falha' },
    });
    expect(JSON.stringify(failed.body)).toContain('"isError":true');

    const note = await handleBridge(id, auth, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    expect(note.status).toBe(202);

    bridge.close();
    expect(
      (await handleBridge(id, auth, { jsonrpc: '2.0', id: 4, method: 'ping' }))
        .status,
    ).toBe(401);
  });
});

describe('a conversa num pedido só', () => {
  it('um pedido sozinho vai tal como está', () => {
    expect(conversationPrompt([{ role: 'user', content: 'olá' }])).toBe('olá');
  });

  it('o histórico vai antes do pedido atual', () => {
    const prompt = conversationPrompt([
      { role: 'user', content: 'cria a viagem' },
      { role: 'assistant', content: 'de que mês?' },
      { role: 'user', content: 'novembro' },
    ]);
    expect(prompt).toContain('CONVERSA ATÉ AGORA');
    expect(prompt.indexOf('de que mês?')).toBeLessThan(
      prompt.indexOf('PEDIDO ATUAL'),
    );
    expect(prompt.trim().endsWith('novembro')).toBe(true);
  });
});

describe('a resposta da ponte', () => {
  const fakeResponse = () => {
    const calls: string[] = [];
    const res = {
      status: (code: number) => {
        calls.push(`status ${code}`);
        return res;
      },
      json: (body: unknown) => calls.push(`json ${JSON.stringify(body)}`),
      end: () => calls.push('end'),
      writeHead: (code: number, headers: Record<string, string>) =>
        calls.push(`head ${code} ${headers['Content-Type']}`),
      write: (chunk: string) => calls.push(chunk),
    };
    return { res, calls };
  };
  const later = <T>(value: T, ms: number) =>
    new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

  it('uma resposta rápida vai em JSON', async () => {
    const { res, calls } = fakeResponse();
    await sendBridgeReply(
      res,
      later({ status: 200, body: { id: 1 } }, 1),
      true,
      50,
      10,
    );
    expect(calls).toEqual(['status 200', 'json {"id":1}']);
  });

  it('uma ferramenta demorada passa a stream, com sinais de vida, e acaba com a resposta', async () => {
    const { res, calls } = fakeResponse();
    await sendBridgeReply(
      res,
      later({ status: 200, body: { id: 2 } }, 80),
      true,
      10,
      20,
    );
    expect(calls[0]).toBe('head 200 text/event-stream');
    expect(
      calls.filter((call) => call === ': a trabalhar\n\n').length,
    ).toBeGreaterThan(1);
    expect(calls.at(-2)).toBe('event: message\ndata: {"id":2}\n\n');
    expect(calls.at(-1)).toBe('end');
  });

  it('sem stream aceite, espera e responde em JSON', async () => {
    const { res, calls } = fakeResponse();
    await sendBridgeReply(
      res,
      later({ status: 202, body: null }, 30),
      false,
      5,
      5,
    );
    expect(calls).toEqual(['status 202', 'end']);
  });
});
