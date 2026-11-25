import { ApiTokenScope } from 'src/generated/prisma/client/client';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** O que nunca se faz com um token: criar tokens, entrar e sair, mexer nos utilizadores. */
const ALWAYS_BLOCKED = [/^\/api-tokens(?:\/|$)/];
const BLOCKED_WRITES = [/^\/auth(?:\/|$)/, /^\/user(?:\/|$)/];

/**
 * Porque é que este pedido não passa com um token deste âmbito, ou null. O READ só lê;
 * o FULL faz o que o utilizador faz no site, menos gerir tokens, sessões e contas.
 */
export function apiTokenRefusal(
  scope: ApiTokenScope,
  method: string,
  path: string,
): string | null {
  const verb = method.toUpperCase();
  if (ALWAYS_BLOCKED.some((rule) => rule.test(path))) {
    return 'Os tokens gerem-se só no site, com a sessão iniciada.';
  }
  if (READ_METHODS.has(verb)) return null;
  if (scope === ApiTokenScope.READ) {
    return 'Este token é só de leitura.';
  }
  if (BLOCKED_WRITES.some((rule) => rule.test(path))) {
    return 'Com um token não se mexe em sessões nem em contas.';
  }
  return null;
}
