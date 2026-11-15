import { dateLocale } from '../../../i18n';

const UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];

export const formatBytes = (bytes: number | null | undefined, digits = 1) => {
  if (bytes == null || !Number.isFinite(bytes)) return '—';

  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }

  const formatted = value.toLocaleString(dateLocale(), { maximumFractionDigits: unit === 0 ? 0 : digits });
  return `${formatted} ${UNITS[unit]}`;
};

export const formatPercent = (fraction: number | null | undefined, digits = 0) => {
  if (fraction == null || !Number.isFinite(fraction)) return '—';
  return `${(fraction * 100).toLocaleString(dateLocale(), { maximumFractionDigits: digits })}%`;
};

export const formatUptime = (seconds: number | null | undefined) => {
  if (!seconds || seconds <= 0) return '—';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export const ratio = (used: number, total: number) => (total > 0 ? used / total : 0);

export const usageLevel = (fraction: number) => {
  if (fraction >= 0.9) return 'danger';
  if (fraction >= 0.7) return 'warn';
  return 'ok';
};
