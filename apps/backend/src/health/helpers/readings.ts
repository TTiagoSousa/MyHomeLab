import { localDay, localMinute } from './timeZone';

/** Uma leitura já extraída do export pelo browser: [instante em ms, valor, fuso "+0100"]. */
export type Reading = [number, number, string | null];

export const isReading = (entry: unknown): entry is Reading =>
  Array.isArray(entry) &&
  typeof entry[0] === 'number' &&
  typeof entry[1] === 'number' &&
  Number.isFinite(entry[1]) &&
  entry[1] > 0;

/** Agrupa as leituras por dia local, uma lista por dia. */
export function byDay(readings: Reading[]): Map<string, Reading[]> {
  const days = new Map<string, Reading[]>();
  for (const reading of readings) {
    const day = localDay(reading[0], reading[2]);
    const list = days.get(day);
    if (list) list.push(reading);
    else days.set(day, [reading]);
  }
  return days;
}

/** Arredonda a N casas decimais. */
export const roundTo = (value: number, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** Um ponto por minuto do dia (a Huawei às vezes repete o minuto), por ordem. */
export function minutePoints(
  readings: Reading[],
  digits = 0,
): [number, number][] {
  const byMinute = new Map<number, number>();
  for (const [time, value, timeZone] of readings) {
    byMinute.set(localMinute(time, timeZone), roundTo(value, digits));
  }
  return [...byMinute.entries()].sort((a, b) => a[0] - b[0]);
}
