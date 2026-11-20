import {
  createVaultwardenClient,
  databaseKind,
  forgetVaultwardenSessions,
  normalizeVaultwardenUrl,
  redactVaultwardenConfig,
} from './vaultwarden.client';

const reply = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Promise.resolve(
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers,
    }),
  );

describe('vaultwarden client', () => {
  const fetchMock = jest.spyOn(global, 'fetch');
  afterEach(() => {
    fetchMock.mockReset();
    forgetVaultwardenSessions();
  });

  it('logs in with the admin token form and sends the VW_ADMIN cookie', async () => {
    fetchMock
      .mockImplementationOnce(() =>
        reply('<html></html>', 200, {
          'set-cookie': 'VW_ADMIN=jwt123; Path=/admin; HttpOnly',
        }),
      )
      .mockImplementationOnce(() =>
        reply([{ id: 'u1', email: 'a@exemplo.com', name: 'A', _status: 0 }]),
      );
    const users = await createVaultwardenClient(
      'https://cofre.exemplo.com/admin/',
      'segredo-admin',
    ).users();
    expect(users).toHaveLength(1);
    const [loginUrl, loginInit] = fetchMock.mock.calls[0];
    expect(loginUrl).toBe('https://cofre.exemplo.com/admin');
    expect(loginInit?.method).toBe('POST');
    expect(loginInit?.body).toBe('token=segredo-admin');
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('https://cofre.exemplo.com/admin/users');
    expect(init?.headers).toMatchObject({ Cookie: 'VW_ADMIN=jwt123' });
  });

  it('explains a refused admin token', async () => {
    fetchMock
      .mockImplementationOnce(() => reply('<html>Invalid</html>', 401))
      .mockImplementationOnce(() => reply('{"message":"Unauthorized"}', 401));
    await expect(
      createVaultwardenClient('https://cofre.exemplo.com', 'errado').users(),
    ).rejects.toThrow('recusou o token de administração');
  });

  it('cleans urls, hides secrets and reads the database kind', () => {
    expect(normalizeVaultwardenUrl(' https://cofre.exemplo.com/#/login ')).toBe(
      'https://cofre.exemplo.com',
    );
    expect(
      redactVaultwardenConfig({
        admin_token: '***',
        smtp_password: 'x',
        signups_allowed: false,
        domain: 'https://cofre.exemplo.com',
      }),
    ).toEqual({
      admin_token: '(escondido)',
      smtp_password: '(escondido)',
      signups_allowed: false,
      domain: 'https://cofre.exemplo.com',
    });
    expect(databaseKind('postgresql://*****')).toBe('postgresql');
    expect(databaseKind('***************')).toBe('sqlite');
  });
});
