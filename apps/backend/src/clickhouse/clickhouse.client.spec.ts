import {
  createClickhouseClient,
  normalizeClickhouseUrl,
} from './clickhouse.client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';

const reply = (
  body: string,
  status = 200,
  headers: Record<string, string> = {},
) => Promise.resolve(new Response(body, { status, headers }));

describe('clickhouse client', () => {
  const fetchMock = jest.spyOn(global, 'fetch');
  afterEach(() => fetchMock.mockReset());

  it('drops /play from a pasted address', () => {
    expect(normalizeClickhouseUrl('https://ch.exemplo.com/play?user=x')).toBe(
      'https://ch.exemplo.com',
    );
    expect(normalizeClickhouseUrl('http://10.0.0.5:8123/')).toBe(
      'http://10.0.0.5:8123',
    );
  });

  it('sends reads with the login headers, readonly and the row cap', async () => {
    fetchMock.mockImplementationOnce(() =>
      reply(
        JSON.stringify({
          meta: [{ name: 'name', type: 'String' }],
          data: [{ name: 'default' }],
          rows: 1,
        }),
      ),
    );
    const result = await createClickhouseClient(
      'https://ch.exemplo.com/play',
      'default',
      'segredo',
    ).select('SELECT name FROM system.databases;', 50);
    expect(result.data).toEqual([{ name: 'default' }]);
    const [url, init] = fetchMock.mock.calls[0];
    const parsed = new URL(url as string);
    expect(parsed.origin + parsed.pathname).toBe('https://ch.exemplo.com/');
    expect(parsed.searchParams.get('readonly')).toBe('2');
    expect(parsed.searchParams.get('max_result_rows')).toBe('50');
    expect(parsed.searchParams.get('default_format')).toBe('JSON');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      'X-ClickHouse-User': 'default',
      'X-ClickHouse-Key': 'segredo',
    });
    expect(init?.body).toBe('SELECT name FROM system.databases');
  });

  it('retries without settings for a readonly user', async () => {
    fetchMock
      .mockImplementationOnce(() =>
        reply(
          "Code: 164. DB::Exception: Cannot modify 'readonly' setting in readonly mode. (READONLY)",
          500,
          { 'X-ClickHouse-Exception-Code': '164' },
        ),
      )
      .mockImplementationOnce(() =>
        reply(
          JSON.stringify({ meta: [], data: [{ a: 1 }, { a: 2 }], rows: 2 }),
        ),
      );
    const result = await createClickhouseClient(
      'https://ch.exemplo.com',
      'leitor',
      'x',
    ).select('SELECT 1', 1);
    expect(result.data).toEqual([{ a: 1 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('maps authentication failures', async () => {
    fetchMock.mockImplementationOnce(() =>
      reply(
        'Code: 516. DB::Exception: default: Authentication failed. (AUTHENTICATION_FAILED)',
        516,
        { 'X-ClickHouse-Exception-Code': '516' },
      ),
    );
    await expect(
      createClickhouseClient(
        'https://ch.exemplo.com',
        'default',
        'mau',
      ).version(),
    ).rejects.toBeInstanceOf(AppIntegrationError);
  });
});
