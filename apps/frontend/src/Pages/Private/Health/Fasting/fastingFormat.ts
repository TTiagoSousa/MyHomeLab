import type { Fast, FastPayload } from '../../../../Hooks/Health/healthLogTypes';
import { dateLocale } from '../../../../i18n';
import { dateInput } from '../Shared/healthFormat';
import { averageOf } from '../Wellbeing/wellbeingFormat';

export const FAST_TARGETS = [12, 14, 16, 18, 20, 24];

export const DEFAULT_FAST_TARGET = 16;

export const FAST_REACHED_COLOR = '#10b981';

export const fastDay = (fast: Fast) => dateInput(new Date(fast.startAt));

export const formatHours = (hours: number | null) => (hours == null ? '—' : `${hours.toFixed(1)} h`);

export const formatMoment = (date: Date) =>
  date.toLocaleString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const formatClock = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${Math.floor(totalSeconds / 3600)}:${pad(Math.floor((totalSeconds % 3600) / 60))}:${pad(totalSeconds % 60)}`;
};

export const fastEnd = (fast: Fast) => new Date(new Date(fast.startAt).getTime() + fast.targetHours * 3_600_000);

export const fastReached = (fast: Fast) => fast.hours != null && fast.hours >= fast.targetHours;

export const openFast = (fasts: Fast[]) => fasts.find((fast) => !fast.endAt) ?? null;

export const lastTarget = (fasts: Fast[]) => fasts[0]?.targetHours ?? DEFAULT_FAST_TARGET;

export const fastStats = (fasts: Fast[]) => {
  const finished = fasts.filter((fast) => fast.hours != null);
  const hours = finished.map((fast) => fast.hours ?? 0);
  const reached = finished.filter(fastReached).length;
  return {
    count: finished.length,
    averageHours: averageOf(hours),
    longest: hours.length ? Math.max(...hours) : null,
    reached,
    successRate: finished.length ? Math.round((reached / finished.length) * 100) : null,
  };
};

export type FastFilter = 'all' | 'reached' | 'missed';

export const FAST_FILTERS: FastFilter[] = ['all', 'reached', 'missed'];

export const filterFasts = (fasts: Fast[], filter: FastFilter, search: string) => {
  const text = search.trim().toLowerCase();
  return fasts.filter(
    (fast) =>
      (filter === 'all' || (fast.endAt != null && fastReached(fast) === (filter === 'reached'))) &&
      (!text || (fast.notes ?? '').toLowerCase().includes(text)),
  );
};

export const finishPayload = (fast: Fast): FastPayload => ({
  startAt: fast.startAt,
  endAt: new Date().toISOString(),
  targetHours: fast.targetHours,
  notes: fast.notes,
});

export const startPayload = (targetHours: number): FastPayload => ({
  startAt: new Date().toISOString(),
  endAt: null,
  targetHours,
  notes: null,
});
