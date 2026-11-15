import { isReadOnlyTool, rpcResult } from './trekMcp.client';

describe('as respostas do MCP do TREK', () => {
  it('lê a resposta numa stream SSE, ignorando os pings e as outras mensagens', () => {
    const body = [
      ': ping',
      'event: message',
      'data: {"jsonrpc":"2.0","method":"notifications/message","params":{}}',
      '',
      'event: message',
      'data: {"jsonrpc":"2.0","id":7,"result":{"tools":[{"name":"list_trips"}]}}',
      '',
    ].join('\n');
    expect(rpcResult(body, 7)).toEqual({ tools: [{ name: 'list_trips' }] });
  });

  it('lê a resposta em JSON simples', () => {
    expect(
      rpcResult('{"jsonrpc":"2.0","id":2,"result":{"ok":true}}', 2),
    ).toEqual({ ok: true });
  });

  it('um erro JSON-RPC lança com a mensagem', () => {
    expect(() =>
      rpcResult(
        'data: {"jsonrpc":"2.0","id":3,"error":{"code":-32602,"message":"trip not found"}}',
        3,
      ),
    ).toThrow('trip not found');
  });

  it('o que só lê vem da anotação ou, sem ela, do nome', () => {
    expect(
      isReadOnlyTool({
        name: 'create_trip',
        annotations: { readOnlyHint: false },
      }),
    ).toBe(false);
    expect(
      isReadOnlyTool({
        name: 'update_trip',
        annotations: { readOnlyHint: true },
      }),
    ).toBe(true);
    expect(isReadOnlyTool({ name: 'list_trips' })).toBe(true);
    expect(isReadOnlyTool({ name: 'delete_trip' })).toBe(false);
  });
});
