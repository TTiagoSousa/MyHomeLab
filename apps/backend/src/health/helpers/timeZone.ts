/** "+0100" → 60. A Huawei guarda o fuso de cada registo neste formato. */
export function offsetMinutes(timeZone: string | null | undefined): number {
  const match = timeZone?.match(/^([+-])(\d{2}):?(\d{2})$/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
}

/** O instante na hora local do registo, para ler dia e hora com os getters UTC. */
export function toLocal(
  time: Date | number,
  timeZone: string | null | undefined,
): Date {
  const ms = typeof time === 'number' ? time : time.getTime();
  return new Date(ms + offsetMinutes(timeZone) * 60_000);
}

/** O dia local de um instante, como "2026-09-22". */
export function localDay(
  time: Date | number,
  timeZone: string | null | undefined,
): string {
  return toLocal(time, timeZone).toISOString().slice(0, 10);
}

/** O minuto do dia (0–1439) de um instante, na hora local. */
export function localMinute(
  time: Date | number,
  timeZone: string | null | undefined,
): number {
  const local = toLocal(time, timeZone);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}
