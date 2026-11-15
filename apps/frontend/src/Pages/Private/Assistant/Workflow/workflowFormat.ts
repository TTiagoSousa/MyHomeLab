import { dateLocale } from '../../../../i18n';

export const formatClock = (date: string) =>
  new Date(date).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const formatDay = (date: string) =>
  new Date(date).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });

export const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

export const formatDuration = (ms: number) => {
  if (ms < 60_000) {
    return `${(ms / 1000).toLocaleString(dateLocale(), { maximumFractionDigits: 1, minimumFractionDigits: 1 })} s`;
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes} min ${seconds} s`;
};

export const formatAgo = (date: string) => {
  const seconds = Math.round((new Date(date).getTime() - Date.now()) / 1000);
  const format = new Intl.RelativeTimeFormat(dateLocale(), { numeric: 'auto' });
  if (Math.abs(seconds) < 60) return format.format(seconds, 'second');
  if (Math.abs(seconds) < 3600) return format.format(Math.round(seconds / 60), 'minute');
  if (Math.abs(seconds) < 86_400) return format.format(Math.round(seconds / 3600), 'hour');
  return format.format(Math.round(seconds / 86_400), 'day');
};
