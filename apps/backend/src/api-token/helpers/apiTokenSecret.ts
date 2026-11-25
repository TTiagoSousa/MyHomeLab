import { createHash, randomBytes } from 'crypto';

/** Os tokens pessoais começam assim: distinguem-se de um JWT e de outros segredos. */
export const API_TOKEN_PREFIX = 'mhl_';

/** O que se mostra na lista para o reconhecer (o resto nunca volta a aparecer). */
const VISIBLE = 12;

/** Um token novo: o texto (mostrado uma vez), o hash (o que se guarda) e o começo. */
export function newApiToken() {
  const token = `${API_TOKEN_PREFIX}${randomBytes(30).toString('base64url')}`;
  return {
    token,
    tokenHash: hashApiToken(token),
    prefix: token.slice(0, VISIBLE),
  };
}

/** SHA-256 chega: o token é aleatório e longo, não é uma password. */
export const hashApiToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

/** O token do cabeçalho "Authorization: Bearer mhl_…", ou null. */
export function apiTokenFrom(authorization: string | undefined): string | null {
  const match = /^Bearer\s+(mhl_[A-Za-z0-9_-]{20,})$/i.exec(
    authorization?.trim() ?? '',
  );
  return match ? match[1] : null;
}
