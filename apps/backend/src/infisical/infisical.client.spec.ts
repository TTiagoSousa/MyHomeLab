import {
  createInfisicalClient,
  forgetInfisicalTokens,
  infisicalTagVersion,
} from './infisical.client';

const reply = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('infisical client', () => {
  const fetchMock = jest.spyOn(global, 'fetch');
  afterEach(() => {
    fetchMock.mockReset();
    forgetInfisicalTokens();
  });

  it('logs in with universal auth and lists secrets with the bearer token', async () => {
    fetchMock
      .mockImplementationOnce(() =>
        reply({ accessToken: 'tok', expiresIn: 7200, tokenType: 'Bearer' }),
      )
      .mockImplementationOnce(() =>
        reply({ secrets: [{ id: '1', secretKey: 'DB_URL' }], imports: [] }),
      );
    const { secrets } = await createInfisicalClient(
      'https://segredos.exemplo.com/api/',
      'cid',
      'csecret',
    ).secrets({ projectId: 'p1', environment: 'prod' });
    expect(secrets.map((secret) => secret.secretKey)).toEqual(['DB_URL']);
    const [loginUrl, loginInit] = fetchMock.mock.calls[0];
    expect(loginUrl).toBe(
      'https://segredos.exemplo.com/api/v1/auth/universal-auth/login',
    );
    expect(loginInit?.body).toBe(
      JSON.stringify({ clientId: 'cid', clientSecret: 'csecret' }),
    );
    const [url, init] = fetchMock.mock.calls[1];
    expect(url as string).toContain(
      'https://segredos.exemplo.com/api/v4/secrets?projectId=p1&environment=prod',
    );
    expect(url as string).toContain('viewSecretValue=false');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer tok' });
  });

  it('falls back to the v3 route on an older Infisical', async () => {
    fetchMock
      .mockImplementationOnce(() =>
        reply({ accessToken: 'tok', expiresIn: 60 }),
      )
      .mockImplementationOnce(() =>
        reply(
          { statusCode: 404, message: 'Route GET:/api/v4/secrets not found' },
          404,
        ),
      )
      .mockImplementationOnce(() => reply({ secrets: [] }));
    await createInfisicalClient('https://s.exemplo.com', 'c', 's').secrets({
      projectId: 'p1',
      environment: 'dev',
    });
    expect(fetchMock.mock.calls[2][0] as string).toContain(
      '/api/v3/secrets/raw?workspaceId=p1',
    );
  });

  it('explains a refused identity', async () => {
    fetchMock.mockImplementation(() =>
      reply({ statusCode: 401, message: 'Invalid credentials' }, 401),
    );
    await expect(
      createInfisicalClient('https://s.exemplo.com', 'c', 's').projects(),
    ).rejects.toThrow('recusou a Machine Identity');
  });

  it('reads platform tags and ignores the others', () => {
    expect(infisicalTagVersion('v0.167.13')).toBe('0.167.13');
    expect(infisicalTagVersion('infisical/v0.93.1-postgres')).toBe('0.93.1');
    expect(infisicalTagVersion('infisical-cli/v0.41.0')).toBeNull();
  });
});
