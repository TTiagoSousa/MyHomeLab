/**
 * O travão do login, com dois contadores:
 * - endereço + utilizador: 5 falhas em 15 minutos bloqueiam esse endereço para esse
 *   utilizador. É o que trava quem tenta adivinhar a password.
 * - só o utilizador, de qualquer endereço: 30 falhas em 5 minutos. Mais alto e mais curto
 *   de propósito — com o limite do par a valer também para o utilizador, qualquer pessoa
 *   na internet errava 5 vezes com "admin" e deixava o admin à porta.
 *
 * Fica em memória (um só processo). As entradas expiradas saem a cada falha e há um teto
 * de chaves, para quem roda endereços e nomes não fazer o Map crescer sem fim.
 */
interface Limit {
  max: number;
  windowMs: number;
}

const PAIR_LIMIT: Limit = { max: 5, windowMs: 15 * 60_000 };
const USER_LIMIT: Limit = { max: 30, windowMs: 5 * 60_000 };
const MAX_KEYS = 10_000;
const LONGEST_WINDOW_MS = Math.max(PAIR_LIMIT.windowMs, USER_LIMIT.windowMs);

const failures = new Map<string, number[]>();

const normalizeUser = (username: string) => username.trim().toLowerCase();
const pairKey = (ip: string, username: string) =>
  `ip:${ip || '?'}|${normalizeUser(username)}`;
const userKey = (username: string) => `user:${normalizeUser(username)}`;

const recent = (key: string, windowMs: number, now: number) =>
  (failures.get(key) ?? []).filter((at) => now - at < windowMs);

function waitMinutes(key: string, limit: Limit, now: number) {
  const list = recent(key, limit.windowMs, now);
  if (list.length < limit.max) return 0;
  const releasedAt = list[list.length - limit.max] + limit.windowMs;
  return Math.max(1, Math.ceil((releasedAt - now) / 60_000));
}

function purgeExpired(now: number) {
  for (const [key, list] of failures) {
    if (!list.some((at) => now - at < LONGEST_WINDOW_MS)) failures.delete(key);
  }
  // O Map guarda a ordem de entrada: acima do teto saem as chaves mais antigas.
  for (const key of failures.keys()) {
    if (failures.size <= MAX_KEYS) break;
    failures.delete(key);
  }
}

function record(key: string, windowMs: number, now: number) {
  const list = [...recent(key, windowMs, now), now];
  failures.delete(key);
  failures.set(key, list);
}

/** Os minutos que faltam para poder tentar outra vez (0 = pode). */
export function loginWaitMinutes(
  ip: string,
  username: string,
  now = Date.now(),
): number {
  return Math.max(
    waitMinutes(pairKey(ip, username), PAIR_LIMIT, now),
    waitMinutes(userKey(username), USER_LIMIT, now),
  );
}

export function recordLoginFailure(
  ip: string,
  username: string,
  now = Date.now(),
) {
  record(pairKey(ip, username), PAIR_LIMIT.windowMs, now);
  record(userKey(username), USER_LIMIT.windowMs, now);
  purgeExpired(now);
}

/** Um login certo limpa só o par: as falhas de outros endereços continuam a contar. */
export function clearLoginFailures(ip: string, username: string) {
  failures.delete(pairKey(ip, username));
}

export function trackedLoginKeys(): number {
  return failures.size;
}
