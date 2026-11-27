import { AgentScheduleRepeat } from 'src/generated/prisma/client/client';

export const SCHEDULE_TIME_ZONE = 'Europe/Lisbon';

export interface ScheduleWhen {
  repeat: AgentScheduleRepeat;
  runAt: Date | null;
  time: string | null;
  weekday: number | null;
  monthDay: number | null;
}

interface LocalDay {
  year: number;
  month: number; // 1–12
  day: number;
  weekday: number; // 1 = segunda … 7 = domingo
}

const WEEKDAYS: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

const parts = (date: Date) => {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: SCHEDULE_TIME_ZONE,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    weekday: WEEKDAYS[values.weekday],
  };
};

/** A hora de Lisboa (dia e "HH:mm") como instante; aguenta a mudança da hora. */
export function lisbonToDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const seen = parts(new Date(guess));
    const shown = Date.UTC(
      seen.year,
      seen.month - 1,
      seen.day,
      seen.hour,
      seen.minute,
    );
    guess += wanted - shown;
  }
  return new Date(guess);
}

export const parseTime = (time: string | null) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time ?? '');
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
};

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const addLocalDays = (day: LocalDay, count: number): LocalDay => {
  const date = new Date(Date.UTC(day.year, day.month - 1, day.day + count));
  const weekday = date.getUTCDay();
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekday: weekday === 0 ? 7 : weekday,
  };
};

const matches = (when: ScheduleWhen, day: LocalDay) => {
  if (when.repeat === AgentScheduleRepeat.DAILY) return true;
  if (when.repeat === AgentScheduleRepeat.WEEKLY) {
    return day.weekday === when.weekday;
  }
  const wanted = Math.min(when.monthDay ?? 1, daysInMonth(day.year, day.month));
  return day.day === wanted;
};

/**
 * A próxima vez que corre, depois de `after`. Uma vez: o runAt (se ainda não passou).
 * Repetidos: o primeiro dia que bate certo, à hora marcada de Lisboa.
 */
export function nextRunAt(when: ScheduleWhen, after: Date): Date | null {
  if (when.repeat === AgentScheduleRepeat.ONCE) {
    return when.runAt && when.runAt > after ? when.runAt : null;
  }
  const time = parseTime(when.time);
  if (!time) return null;
  const today = parts(after);
  const start: LocalDay = {
    year: today.year,
    month: today.month,
    day: today.day,
    weekday: today.weekday,
  };
  for (let offset = 0; offset <= 62; offset++) {
    const day = addLocalDays(start, offset);
    if (!matches(when, day)) continue;
    const candidate = lisbonToDate(
      day.year,
      day.month,
      day.day,
      time.hour,
      time.minute,
    );
    if (candidate > after) return candidate;
  }
  return null;
}

const WEEKDAY_NAMES = [
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
  'domingo',
];

export const lisbonLabel = (date: Date) =>
  date.toLocaleString('pt-PT', {
    timeZone: SCHEDULE_TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'short',
  });

/** Em palavras, para os agentes: "todos os dias às 05:00", "uma vez a 15/11/2026, 09:00". */
export function describeWhen(when: ScheduleWhen): string {
  switch (when.repeat) {
    case AgentScheduleRepeat.ONCE:
      return when.runAt ? `uma vez, a ${lisbonLabel(when.runAt)}` : 'uma vez';
    case AgentScheduleRepeat.DAILY:
      return `todos os dias às ${when.time}`;
    case AgentScheduleRepeat.WEEKLY:
      return `todas as semanas, ${WEEKDAY_NAMES[(when.weekday ?? 1) - 1]} às ${when.time}`;
    case AgentScheduleRepeat.MONTHLY:
      return `todos os meses, dia ${when.monthDay} às ${when.time}`;
  }
}
