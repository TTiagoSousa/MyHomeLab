import { ApiTokenScope } from 'src/generated/prisma/client/client';
import { apiTokenRefusal } from './apiTokenAccess';
import { apiTokenFrom, hashApiToken, newApiToken } from './apiTokenSecret';

describe('os tokens pessoais', () => {
  it('o de leitura só lê', () => {
    expect(
      apiTokenRefusal(ApiTokenScope.READ, 'GET', '/board/tasks'),
    ).toBeNull();
    expect(
      apiTokenRefusal(ApiTokenScope.READ, 'POST', '/assistant/chat'),
    ).toMatch(/leitura/);
    expect(apiTokenRefusal(ApiTokenScope.READ, 'DELETE', '/todos/1')).toMatch(
      /leitura/,
    );
  });

  it('o completo escreve, menos tokens, sessões e contas', () => {
    expect(
      apiTokenRefusal(ApiTokenScope.FULL, 'POST', '/assistant/chat'),
    ).toBeNull();
    expect(apiTokenRefusal(ApiTokenScope.FULL, 'POST', '/auth/logout')).toMatch(
      /sessões/,
    );
    expect(apiTokenRefusal(ApiTokenScope.FULL, 'POST', '/user')).toMatch(
      /contas/,
    );
    expect(apiTokenRefusal(ApiTokenScope.FULL, 'GET', '/api-tokens')).toMatch(
      /site/,
    );
    expect(
      apiTokenRefusal(ApiTokenScope.FULL, 'DELETE', '/api-tokens/x'),
    ).toMatch(/site/);
  });

  it('só se guarda o hash e o cabeçalho tem de ser um token nosso', () => {
    const { token, tokenHash, prefix } = newApiToken();
    expect(token.startsWith('mhl_')).toBe(true);
    expect(tokenHash).toBe(hashApiToken(token));
    expect(tokenHash).not.toContain(token);
    expect(token.startsWith(prefix)).toBe(true);
    expect(apiTokenFrom(`Bearer ${token}`)).toBe(token);
    expect(apiTokenFrom('Bearer eyJhbGciOi.jwt.qualquer')).toBeNull();
    expect(apiTokenFrom(undefined)).toBeNull();
  });
});
