const shift = (day: string, days: number) => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/**
 * A sequência atual (dias seguidos até hoje; se hoje ainda não foi feito,
 * conta até ontem) e a melhor de sempre, a partir dos dias cumpridos.
 */
export function habitStreaks(days: string[], today: string) {
  const done = new Set(days);
  let current = 0;
  let cursor = done.has(today) ? today : shift(today, -1);
  while (done.has(cursor)) {
    current += 1;
    cursor = shift(cursor, -1);
  }

  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of [...done].sort()) {
    run = previous && shift(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return { current, best };
}
