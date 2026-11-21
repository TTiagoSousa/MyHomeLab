import {
  clearLoginFailures,
  loginWaitMinutes,
  recordLoginFailure,
  trackedLoginKeys,
} from './loginThrottle';

const MINUTE = 60_000;

function fail(ip: string, username: string, times: number, now: number) {
  for (let i = 0; i < times; i++) recordLoginFailure(ip, username, now);
}

describe('loginThrottle', () => {
  it('bloqueia o endereço que falha 5 vezes, mas não os outros', () => {
    const now = 1_000_000;
    fail('192.0.2.10', 'admin', 5, now);
    expect(loginWaitMinutes('192.0.2.10', 'admin', now)).toBe(15);
    expect(loginWaitMinutes('192.0.2.11', 'admin', now)).toBe(0);
    expect(loginWaitMinutes('192.0.2.10', 'outro', now)).toBe(0);
  });

  it('o utilizador não conta maiúsculas nem espaços', () => {
    const now = 2_000_000;
    fail('192.0.2.20', ' Admin ', 5, now);
    expect(loginWaitMinutes('192.0.2.20', 'admin', now)).toBeGreaterThan(0);
  });

  it('desbloqueia ao fim da janela', () => {
    const now = 3_000_000;
    fail('192.0.2.30', 'ana', 5, now);
    expect(loginWaitMinutes('192.0.2.30', 'ana', now + 15 * MINUTE)).toBe(0);
  });

  it('um login certo limpa só o seu endereço', () => {
    const now = 4_000_000;
    fail('192.0.2.40', 'rui', 5, now);
    fail('192.0.2.41', 'rui', 5, now);
    clearLoginFailures('192.0.2.40', 'rui');
    expect(loginWaitMinutes('192.0.2.40', 'rui', now)).toBe(0);
    expect(loginWaitMinutes('192.0.2.41', 'rui', now)).toBe(15);
  });

  it('o utilizador sozinho só bloqueia com muitas falhas de vários sítios, e por pouco tempo', () => {
    const now = 5_000_000;
    for (let i = 0; i < 29; i++)
      recordLoginFailure(`198.51.100.${i}`, 'eva', now);
    expect(loginWaitMinutes('203.0.113.1', 'eva', now)).toBe(0);
    recordLoginFailure('198.51.100.99', 'eva', now);
    expect(loginWaitMinutes('203.0.113.1', 'eva', now)).toBe(5);
    expect(loginWaitMinutes('203.0.113.1', 'eva', now + 5 * MINUTE)).toBe(0);
  });

  it('as entradas expiradas saem do Map', () => {
    const now = 6_000_000;
    fail('192.0.2.60', 'temp', 1, now);
    fail('192.0.2.62', 'temp2', 1, now);
    expect(trackedLoginKeys()).toBeGreaterThan(2);
    recordLoginFailure('192.0.2.61', 'depois', now + 16 * MINUTE);
    expect(trackedLoginKeys()).toBe(2);
  });
});
