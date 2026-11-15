import { dateLocale } from '../i18n';

const pad = (value: number) => String(value).padStart(2, '0');

export const formatDay = (isoDay: string) => {
  const [year, month, day] = isoDay.split('-').map(Number);
  if (!year || !month || !day) return isoDay;
  return new Date(year, month - 1, day).toLocaleDateString(dateLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const offsetOf = (date: Date) => {
  const minutes = -date.getTimezoneOffset();
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);
  return `${sign}${pad(Math.floor(absolute / 60))}${pad(absolute % 60)}`;
};

export const localDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const shiftDay = (isoDay: string, days: number) => {
  const [year, month, day] = isoDay.split('-').map(Number);
  return localDay(new Date(year, month - 1, day + days));
};

export const formatNumber = (value: number, digits = 1) =>
  new Intl.NumberFormat(dateLocale(), { maximumFractionDigits: digits }).format(value);
