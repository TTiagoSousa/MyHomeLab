/** As datas das ferramentas falam sempre na hora de Portugal. */
export const TIME_ZONE = 'Europe/Lisbon';

/** O texto de uma falha para o agente. */
export const failure = (error: unknown) =>
  `Não consegui: ${error instanceof Error ? error.message : String(error)}`;

/** O dia de hoje em Portugal, AAAA-MM-DD. */
export const lisbonToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now);

const STAMP = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Uma hora sem fuso ("2026-08-01T20:00:00") vem das APIs em UTC. */
const NO_ZONE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

/**
 * "AAAA-MM-DD HH:mm" à hora de Portugal, para mostrar datas das apps (ISO, Date ou
 * segundos desde 1970). Sem data, o `empty`.
 */
export function lisbonStamp(
  value: Date | string | number | null | undefined,
  empty = '—',
): string {
  if (value === null || value === undefined || value === '') return empty;
  const date =
    typeof value === 'number'
      ? new Date(value * 1000)
      : typeof value === 'string'
        ? new Date(NO_ZONE.test(value.trim()) ? `${value.trim()}Z` : value)
        : value;
  return Number.isNaN(date.getTime()) ? String(value) : STAMP.format(date);
}

/**
 * Uma data escrita pelo agente: "AAAA-MM-DD HH:mm" (ou com T e segundos) sem fuso é
 * hora de Portugal; um ISO com fuso vale como está. Inválida: null.
 */
export function parseLisbonDate(value: string): Date | null {
  const local = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(:\d{2}(\.\d+)?)?$/.exec(
    value.trim(),
  );
  if (local) return lisbonInstant(local[1], local[2]);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Minutos de diferença do fuso para UTC nesse instante (Lisboa: 0 ou 60). */
function zoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** O instante de uma hora de relógio num fuso (ex.: 20:00 em Lisboa a 23 de outubro). */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  // Duas passagens acertam as horas na mudança de hora (o fuso do palpite pode não
  // ser o da hora certa).
  let result = guess - zoneOffsetMinutes(new Date(guess), timeZone) * 60_000;
  result = guess - zoneOffsetMinutes(new Date(result), timeZone) * 60_000;
  return new Date(result);
}

/** O instante de um dia (AAAA-MM-DD) e hora (HH:MM) de Portugal. */
export function lisbonInstant(date: string, time = '00:00'): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('A data tem de vir como AAAA-MM-DD.');
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new Error('A hora tem de vir como HH:MM.');
  }
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return zonedTimeToUtc(year, month, day, hour, minute, TIME_ZONE);
}
