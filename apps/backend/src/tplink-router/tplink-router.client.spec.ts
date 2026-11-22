import axios from 'axios';
import { constants, generateKeyPairSync, privateDecrypt } from 'crypto';
import { aesDecrypt, aesEncrypt, rsaOaep, rsaPkcs1 } from './tplink-crypto';
import {
  describeConnection,
  forgetTplinkRouter,
  normalizeMac,
  tplinkConnection,
  TplinkOfflineError,
  withTplinkRouter,
} from './tplink-router.client';

jest.mock('axios');
// eslint-disable-next-line @typescript-eslint/unbound-method
const post = axios.post as jest.MockedFunction<typeof axios.post>;

const hexOf = (b64url: string) =>
  Buffer.from(b64url, 'base64url').toString('hex');

function rsaPair(bits: number) {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: bits });
  const jwk = privateKey.export({ format: 'jwk' });
  return { privateKey, n: hexOf(jwk.n!), e: hexOf(jwk.e!), d: hexOf(jwk.d!) };
}

const modPow = (base: bigint, exponent: bigint, modulus: bigint) => {
  let result = 1n;
  let b = base % modulus;
  let e = exponent;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus;
    e >>= 1n;
    b = (b * b) % modulus;
  }
  return result;
};

describe('tplink-crypto', () => {
  const key = rsaPair(1024);

  it('cifra em PKCS#1 v1.5 que a chave privada decifra', () => {
    const cipher = rsaPkcs1('palavra', key.n, key.e);
    expect(cipher).toHaveLength(256);
    const plain = modPow(
      BigInt(`0x${cipher}`),
      BigInt(`0x${key.d}`),
      BigInt(`0x${key.n}`),
    )
      .toString(16)
      .padStart(256, '0');
    const block = Buffer.from(plain, 'hex');
    expect(block[0]).toBe(0);
    expect(block[1]).toBe(2);
    const separator = block.indexOf(0, 2);
    expect(block.subarray(separator + 1).toString()).toBe('palavra');
  });

  it('cifra em OAEP (SHA-1) como o OpenSSL', () => {
    const cipher = rsaOaep('k=1&i=2&h=abc&s=9', key.n, key.e);
    const plain = privateDecrypt(
      {
        key: key.privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha1',
      },
      Buffer.from(cipher, 'hex'),
    );
    expect(plain.toString()).toBe('k=1&i=2&h=abc&s=9');
  });

  it('AES ida e volta com chave de 16 caracteres', () => {
    const enc = aesEncrypt(
      'operation=read',
      '0123456789abcdef',
      'fedcba9876543210',
    );
    expect(aesDecrypt(enc, '0123456789abcdef', 'fedcba9876543210')).toBe(
      'operation=read',
    );
  });

  it('normaliza o MAC como o router guarda', () => {
    expect(normalizeMac('aa:bb:cc:dd:ee:ff')).toBe('AA-BB-CC-DD-EE-FF');
    expect(() => normalizeMac('xyz')).toThrow();
  });
});

describe('withTplinkRouter (firmware 1.11, sem cifra)', () => {
  const big = rsaPair(2048);
  const account = {
    id: 'r1',
    baseUrl: 'http://router.exemplo.com',
    username: 'admin',
    appPassword: 'segredo',
    scopes: [],
  };
  const reply = (
    body: unknown,
    status = 200,
    headers: Record<string, string> = {},
  ) => Promise.resolve({ status, data: JSON.stringify(body), headers });

  let sessionAlive = true;

  beforeEach(() => {
    forgetTplinkRouter('r1');
    sessionAlive = true;
    post.mockReset();
    post.mockImplementation((url: string) => {
      if (url.includes('form=keys')) {
        return reply({ success: true, data: { password: [big.n, big.e] } });
      }
      if (url.includes('form=auth')) return reply({}, 404);
      if (url.includes('form=login')) {
        return reply({ success: true, data: { stok: 'tok' } }, 200, {
          'set-cookie': 'sysauth=abc; path=/',
        });
      }
      if (!sessionAlive) return reply({}, 403);
      if (url.includes('form=upgrade')) {
        return reply({
          success: true,
          data: {
            model: 'Archer BE400',
            firmware_version: '1.2.0',
            hardware_version: '1.0',
          },
        });
      }
      return reply({ success: false, errorcode: 'unknown' });
    });
  });

  it('entra com a maneira certa e manda o pedido em JSON, com o cookie', async () => {
    const firmware = await withTplinkRouter(account, (router) =>
      router.firmware(),
    );
    expect(firmware.model).toBe('Archer BE400');
    const call = post.mock.calls.find(([url]) => url.includes('form=upgrade'))!;
    expect(call[0]).toContain(
      ';stok=tok/admin/firmware?form=upgrade&operation=read',
    );
    expect(JSON.parse(call[1] as string)).toEqual({ operation: 'read' });
    expect(
      (call[2] as { headers: Record<string, string> }).headers.Cookie,
    ).toBe('sysauth=abc');
    expect(tplinkConnection(account).scheme).toBe('v1_11');
  });

  it('sessão que cai fica "desligado" (não erro) e só volta a tentar daqui a 5 min', async () => {
    await withTplinkRouter(account, (router) => router.firmware());
    sessionAlive = false;
    const failure = await withTplinkRouter(account, (router) =>
      router.firmware(),
    ).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(TplinkOfflineError);
    const connection = tplinkConnection(account);
    expect(connection.state).toBe('disconnected');
    expect(Date.parse(connection.nextRetryAt!) - Date.now()).toBeGreaterThan(
      4 * 60_000,
    );
    expect(describeConnection(connection)).toContain('Não é um erro');

    const calls = post.mock.calls.length;
    await expect(
      withTplinkRouter(account, (router) => router.firmware()),
    ).rejects.toBeInstanceOf(TplinkOfflineError);
    expect(post.mock.calls.length).toBe(calls);

    sessionAlive = true;
    await withTplinkRouter(account, (router) => router.firmware(), {
      force: true,
    });
    expect(tplinkConnection(account).state).toBe('connected');
  });

  it('não sai por inatividade a meio de um trabalho que começa perto dos 90 s', async () => {
    jest.useFakeTimers();
    try {
      await withTplinkRouter(account, (router) => router.firmware());
      jest.advanceTimersByTime(85_000);
      let finish: () => void = () => undefined;
      const slow = withTplinkRouter(account, async (router) => {
        await new Promise<void>((resolve) => (finish = resolve));
        return router.firmware();
      });
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(10_000);
      const logouts = () =>
        post.mock.calls.filter(([url]) => url.includes('form=logout')).length;
      expect(logouts()).toBe(0);
      finish();
      await slow;
      jest.advanceTimersByTime(91_000);
      expect(logouts()).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('um erro ao entrar (router a arrancar) fica "desligado" com a próxima daqui a 5 min', async () => {
    post.mockImplementation(() => reply('<html>a arrancar</html>', 200));
    await expect(
      withTplinkRouter(account, (router) => router.firmware()),
    ).rejects.toBeInstanceOf(TplinkOfflineError);
    const connection = tplinkConnection(account);
    expect(connection.state).toBe('disconnected');
    expect(Date.parse(connection.nextRetryAt!) - Date.now()).toBeGreaterThan(
      4 * 60_000,
    );
  });

  it('palavra-passe errada fica "falhou" e não volta a tentar sozinha', async () => {
    post.mockImplementation((url: string) => {
      if (url.includes('form=keys')) {
        return reply({ success: true, data: { password: [big.n, big.e] } });
      }
      if (url.includes('form=auth')) return reply({}, 404);
      return reply({
        success: false,
        errorcode: 'login failed',
        data: { failureCount: 1 },
      });
    });
    await expect(
      withTplinkRouter(account, (router) => router.firmware()),
    ).rejects.toBeInstanceOf(TplinkOfflineError);
    const connection = tplinkConnection(account);
    expect(connection.state).toBe('failed');
    expect(connection.nextRetryAt).toBeNull();
  });
});

describe('extensor (RE, sem cifra)', () => {
  const key = rsaPair(1024);
  const reply = (
    body: unknown,
    status = 200,
    headers: Record<string, string> = {},
  ) => Promise.resolve({ status, data: JSON.stringify(body), headers });

  beforeEach(() => {
    forgetTplinkRouter('e1');
    post.mockReset();
    post.mockImplementation((url: string) => {
      if (url.includes('form=keys') || url.includes('form=auth'))
        return reply({}, 400);
      if (url.includes('form=login&operation=read')) {
        return reply({ success: true, data: { password: [key.n, key.e] } });
      }
      if (url.includes('form=login')) {
        return reply({ success: true, data: { stok: 'ext' } }, 200, {
          'set-cookie': 'sysauth=xyz; path=/',
        });
      }
      if (url.includes('form=ap_status')) {
        return reply({
          success: true,
          data: {
            wireless_2g_enable: 'on',
            wireless_5g_enable: 'on',
            wirelessCount: 1,
            wirelessGrid: [
              {
                mac: 'aa:bb:cc:00:00:01',
                ip: '10.0.0.5',
                name: 'tv',
                type: '5G',
              },
            ],
          },
        });
      }
      if (url.includes('form=all'))
        return reply({ success: false, errorcode: 'no such callback' });
      if (url.includes('form=upgrade')) {
        return reply({
          success: true,
          data: { model: 'RE225BE', firmware_version: '1.0.0' },
        });
      }
      return reply({ success: false, errorcode: 'no such callback' });
    });
  });

  it('entra sem cifra, vê que é um extensor e lê os clientes Wi-Fi', async () => {
    const { probeTplinkRouter, tplinkScopes } =
      await import('./tplink-router.client');
    const probe = await probeTplinkRouter({
      baseUrl: 'http://extensor.exemplo.com',
      username: 'admin',
      password: 'segredo',
    });
    expect(probe).toMatchObject({ scheme: 're_plain', kind: 'extender' });
    expect(probe.firmware.model).toBe('RE225BE');

    const account = {
      id: 'e1',
      baseUrl: 'http://extensor.exemplo.com',
      username: 'admin',
      appPassword: 'segredo',
      scopes: tplinkScopes('re_plain', 'extender'),
    };
    const status = await withTplinkRouter(account, (router) =>
      router.status(true),
    );
    expect(status.wifi.host['5g']).toBe(true);
    expect(status.devices).toEqual([
      expect.objectContaining({
        mac: 'AA-BB-CC-00-00-01',
        ip: '10.0.0.5',
        connection: 'host_5g',
      }),
    ]);
    await expect(
      withTplinkRouter(account, (router) => router.reservations()),
    ).rejects.toThrow('isto é um extensor');
    expect(tplinkConnection(account).kind).toBe('extender');
  });
});
