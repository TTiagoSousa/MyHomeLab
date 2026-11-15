import { dateLocale } from '../../../../i18n';

const pad = (value: number) => String(value).padStart(2, '0');

export const dateInput = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const timeInput = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

export const isBeforePeriod = (at: string, days: number) =>
  days > 0 && new Date(at).getTime() < Date.now() - days * 24 * 60 * 60 * 1000;

export const browserTimeZone = (date: Date) => {
  const offset = -date.getTimezoneOffset();
  const absolute = Math.abs(offset);
  return `${offset < 0 ? '-' : '+'}${pad(Math.floor(absolute / 60))}${pad(absolute % 60)}`;
};

export const formatDuration = (minutes: number | null | undefined) => {
  if (minutes == null) return '—';
  const rounded = Math.round(minutes);
  return `${Math.floor(rounded / 60)}h ${pad(rounded % 60)}m`;
};

const offsetMinutes = (timeZone: string | null) => {
  const match = timeZone?.match(/^([+-])(\d{2}):?(\d{2})$/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
};

export const localClock = (iso: string | null, timeZone: string | null) => {
  if (!iso) return '—';
  const local = new Date(Date.parse(iso) + offsetMinutes(timeZone) * 60_000);
  return `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
};

export const minuteClock = (minute: number | null | undefined) =>
  minute == null ? '—' : `${pad(Math.floor(minute / 60) % 24)}:${pad(minute % 60)}`;

export const formatDay = (day: string, withWeekday = true) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString(dateLocale(), {
    weekday: withWeekday ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

export const monthLabel = (month: string) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString(dateLocale(), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

export const valueOrDash = (value: number | null | undefined, unit = '') =>
  value == null ? '—' : `${value}${unit}`;

export const percentOf = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

export const colorDot = (color: string) =>
  `<span style="display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;background:${color}"></span>`;

export const formatDistance = (meters: number | null | undefined) => {
  if (meters == null) return '—';
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
};

export const formatSteps = (steps: number | null | undefined) =>
  steps == null ? '—' : steps.toLocaleString(dateLocale());
