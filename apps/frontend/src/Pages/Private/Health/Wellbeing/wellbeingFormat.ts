import { dateInput } from '../Shared/healthFormat';

const shiftDay = (day: string, offset: number) => {
  const date = new Date(`${day}T12:00`);
  date.setDate(date.getDate() + offset);
  return dateInput(date);
};

export const periodStart = (days: number, today: string) => (days > 0 ? shiftDay(today, -(days - 1)) : null);

export const previousPeriodStart = (days: number, today: string) => (days > 0 ? shiftDay(today, -(days * 2 - 1)) : null);

export const splitByPeriod = <T,>(items: T[], dayOf: (item: T) => string, days: number, today: string) => {
  const start = periodStart(days, today);
  const previousStart = previousPeriodStart(days, today);
  if (!start || !previousStart) return { current: items, previous: [] as T[] };
  return {
    current: items.filter((item) => dayOf(item) >= start),
    previous: items.filter((item) => dayOf(item) < start && dayOf(item) >= previousStart),
  };
};

export const averageOf = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export const formatAverage = (value: number | null, digits = 1) => (value == null ? '—' : value.toFixed(digits));

export const changeOf = (current: number | null, previous: number | null) =>
  current == null || previous == null ? null : Math.round((current - previous) * 10) / 10;

export const formatChange = (change: number) => `${change > 0 ? '+' : change < 0 ? '−' : '±'}${Math.abs(change).toFixed(1)}`;

export const changeClass = (change: number) => (change > 0 ? 'up' : change < 0 ? 'down' : '');
