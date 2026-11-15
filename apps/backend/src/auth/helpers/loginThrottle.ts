/** Falhas de login por endereço e utilizador: 5 em 15 minutos e espera-se. */
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60_000;

const failures = new Map<string, number[]>();

const recent = (key: string, now: number) =>
  (failures.get(key) ?? []).filter((at) => now - at < WINDOW_MS);

/** Os minutos que faltam para poder tentar outra vez (0 = pode). */
export function loginWaitMinutes(key: string, now = Date.now()): number {
  const list = recent(key, now);
  if (list.length < MAX_FAILURES) return 0;
  return Math.max(1, Math.ceil((list[0] + WINDOW_MS - now) / 60_000));
}

export function recordLoginFailure(key: string, now = Date.now()) {
  failures.set(key, [...recent(key, now), now]);
}

export function clearLoginFailures(key: string) {
  failures.delete(key);
}
