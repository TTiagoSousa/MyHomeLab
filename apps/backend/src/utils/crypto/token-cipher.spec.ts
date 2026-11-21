import { randomBytes } from 'crypto';
import { decryptToken, encryptToken } from './token-cipher';

describe('token-cipher', () => {
  beforeAll(() => {
    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  });

  it('cifra e decifra', () => {
    expect(decryptToken(encryptToken('segredo'))).toBe('segredo');
  });

  it('recusa um tag truncado', () => {
    const [iv, tag, data] = encryptToken('segredo').split('.');
    const short = Buffer.from(tag, 'base64').subarray(0, 4).toString('base64');
    expect(() => decryptToken([iv, short, data].join('.'))).toThrow(
      'Formato de token cifrado inválido',
    );
  });

  it('recusa um valor alterado', () => {
    const [iv, tag, data] = encryptToken('segredo').split('.');
    const bytes = Buffer.from(data, 'base64');
    bytes[0] ^= 1;
    expect(() =>
      decryptToken([iv, tag, bytes.toString('base64')].join('.')),
    ).toThrow();
  });
});
