import {
  createNginxProxyManagerClient,
  forgetNginxProxyManagerToken,
  nginxProxyManagerVersion,
  normalizeNginxProxyManagerUrl,
} from './nginx-proxy-manager.client';

const reply = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

const inAWeek = () => new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

describe('nginx proxy manager client', () => {
  const fetchMock = jest.spyOn(global, 'fetch');
  afterEach(() => {
    fetchMock.mockReset();
    forgetNginxProxyManagerToken('http://192.0.2.10:81', 'admin@exemplo.com');
  });

  it('logs in once over plain http and sends the JWT', async () => {
    fetchMock
      .mockImplementationOnce(() =>
        reply({ token: 'jwt1', expires: inAWeek() }),
      )
      .mockImplementationOnce(() =>
        reply([{ id: 1, domain_names: ['a.exemplo.com'] }]),
      )
      .mockImplementationOnce(() => reply([]));
    const client = createNginxProxyManagerClient(
      '192.0.2.10:81/login',
      'admin@exemplo.com',
      'secret',
    );
    const hosts = await client.proxyHosts();
    await client.streams();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [loginUrl, loginInit] = fetchMock.mock.calls[0];
    expect(loginUrl).toBe('http://192.0.2.10:81/api/tokens');
    expect(loginInit?.body).toBe(
      JSON.stringify({ identity: 'admin@exemplo.com', secret: 'secret' }),
    );
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(
      'http://192.0.2.10:81/api/nginx/proxy-hosts?expand=certificate,access_list',
    );
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer jwt1' });
    expect(hosts[0].id).toBe(1);
  });

  it('maps a refused login to an auth error', async () => {
    fetchMock.mockImplementation(() =>
      reply(
        { error: { code: 401, message: 'Invalid email or password' } },
        401,
      ),
    );
    await expect(
      createNginxProxyManagerClient(
        'http://192.0.2.10:81',
        'admin@exemplo.com',
        'wrong',
      ).certificates(),
    ).rejects.toMatchObject({ code: 'APP_AUTH_FAILED' });
  });

  it('refuses accounts with two-factor login', async () => {
    fetchMock.mockImplementationOnce(() =>
      reply({ requires_2fa: true, challenge_token: 'c' }),
    );
    await expect(
      createNginxProxyManagerClient(
        'http://192.0.2.10:81',
        'admin@exemplo.com',
        'secret',
      ).me(),
    ).rejects.toThrow('dois passos');
  });

  it('reads the version without logging in', async () => {
    fetchMock.mockImplementationOnce(() =>
      reply({
        status: 'OK',
        setup: true,
        version: { major: 2, minor: 17, revision: 1 },
      }),
    );
    await expect(
      nginxProxyManagerVersion('http://192.0.2.10:81/'),
    ).resolves.toBe('v2.17.1');
    expect(fetchMock.mock.calls[0][0]).toBe('http://192.0.2.10:81/api/');
    expect(
      normalizeNginxProxyManagerUrl('https://npm.exemplo.com/nginx/proxy'),
    ).toBe('https://npm.exemplo.com');
  });
});
