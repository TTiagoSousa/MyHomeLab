import {
  coolifyVersion,
  createCoolifyClient,
  normalizeCoolifyUrl,
  parseMcpBody,
} from './coolify.client';

const reply = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
    }),
  );

describe('coolify client', () => {
  const fetchMock = jest.spyOn(global, 'fetch');
  afterEach(() => fetchMock.mockReset());

  it('lists applications with the bearer token', async () => {
    fetchMock.mockImplementationOnce(() =>
      reply([{ uuid: 'a1', name: 'web', status: 'running:healthy' }]),
    );
    const apps = await createCoolifyClient(
      'https://coolify.exemplo.com/api/v1/',
      '1|tok',
    ).list('applications');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://coolify.exemplo.com/api/v1/applications');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer 1|tok' });
    expect(apps.map((item) => item.name)).toEqual(['web']);
  });

  it('reads the plain text version, beta tags included', async () => {
    fetchMock.mockImplementationOnce(() => reply('4.0.0-beta.420'));
    await expect(
      coolifyVersion('coolify.exemplo.com:8000', 'tok'),
    ).resolves.toBe('v4.0.0-beta.420');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://coolify.exemplo.com:8000/api/v1/version',
    );
  });

  it('says when the API is disabled', async () => {
    fetchMock.mockImplementationOnce(() =>
      reply({ success: false, message: 'API is disabled.' }, 403),
    );
    await expect(
      createCoolifyClient('https://c.exemplo.com', 'tok').servers(),
    ).rejects.toThrow('API Access');
  });

  it('maps 401 to an auth error', async () => {
    fetchMock.mockImplementationOnce(() =>
      reply({ message: 'Unauthenticated.' }, 401),
    );
    await expect(
      createCoolifyClient('https://c.exemplo.com', 'tok').projects(),
    ).rejects.toMatchObject({ code: 'APP_AUTH_FAILED' });
  });

  it('deploys by uuid with force in the query', async () => {
    fetchMock.mockImplementationOnce(() =>
      reply({ deployments: [{ message: 'ok', deployment_uuid: 'd1' }] }),
    );
    await createCoolifyClient('https://c.exemplo.com', 'tok').deploy({
      uuids: ['a1', 'a2'],
      force: true,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://c.exemplo.com/api/v1/deploy?uuid=a1%2Ca2&force=true',
    );
    expect(init?.method).toBe('POST');
  });

  it('cleans pasted addresses and reads MCP answers in SSE', () => {
    expect(normalizeCoolifyUrl(' https://c.exemplo.com/mcp/ ')).toBe(
      'https://c.exemplo.com',
    );
    expect(
      parseMcpBody('event: message\ndata: {"result":{"tools":[]}}\n\n'),
    ).toEqual({ result: { tools: [] } });
  });
});
