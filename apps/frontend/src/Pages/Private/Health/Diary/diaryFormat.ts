import type { DiaryEntry, DiaryKind } from '../../../../Hooks/Health/healthTypes';

export const DIARY_KINDS: DiaryKind[] = ['PAIN', 'SYMPTOM', 'ALLERGY', 'DAY', 'NOTE'];

export const TEXT_KINDS: DiaryKind[] = ['NOTE', 'DAY'];

export const BODY_AREAS = [
  'head',
  'neck',
  'shoulders',
  'chest',
  'back_upper',
  'back_lower',
  'abdomen',
  'arms',
  'hands',
  'hips',
  'legs',
  'knees',
  'feet',
  'teeth',
  'other',
];

export const ALLERGY_AREAS = ['skin', 'eyes', 'nose', 'throat', 'mouth', 'breathing', 'stomach', 'other'];

export const areasOf = (kind: DiaryKind) => (kind === 'PAIN' ? BODY_AREAS : kind === 'ALLERGY' ? ALLERGY_AREAS : null);

export const areaLabelKey = (kind: DiaryKind, area: string) =>
  kind === 'ALLERGY' ? `diary.allergyAreas.${area}` : `diary.areas.${area}`;

export const DIARY_PERIODS = [7, 30, 90, 0];

export type DiaryPeriod = number | 'custom';

export interface DiaryFilters {
  period: DiaryPeriod;
  from: string;
  to: string;
  kinds: DiaryKind[];
  search: string;
}

export const DEFAULT_FILTERS: DiaryFilters = { period: 0, from: '', to: '', kinds: [], search: '' };

export const intensityClass = (intensity: number | null) => {
  if (intensity == null) return '';
  if (intensity >= 7) return 'high';
  if (intensity >= 4) return 'medium';
  return 'low';
};

export const shiftDay = (day: string, days: number) => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const filterRange = (filters: DiaryFilters, today: string) => {
  if (filters.period === 'custom') return { from: filters.from || null, to: filters.to || null };
  if (filters.period > 0) return { from: shiftDay(today, 1 - filters.period), to: null };
  return { from: null, to: null };
};

type FilterableEntry = Pick<DiaryEntry, 'day' | 'kind' | 'text' | 'trigger'>;

export const matchesFilters = (entry: FilterableEntry, filters: DiaryFilters, today: string) => {
  const { from, to } = filterRange(filters, today);
  const search = filters.search.trim().toLowerCase();
  return (
    (!from || entry.day >= from) &&
    (!to || entry.day <= to) &&
    (!filters.kinds.length || filters.kinds.includes(entry.kind)) &&
    (!search || `${entry.text ?? ''} ${entry.trigger ?? ''}`.toLowerCase().includes(search))
  );
};

export const filterEntries = (entries: DiaryEntry[], filters: DiaryFilters, today: string) =>
  entries.filter((entry) => matchesFilters(entry, filters, today));

export const allergyContext = (entries: DiaryEntry[], allergy: DiaryEntry) => {
  const days = [allergy.day, shiftDay(allergy.day, -1)];
  return entries.filter(
    (entry) => entry.id !== allergy.id && (entry.kind === 'DAY' || entry.kind === 'NOTE') && days.includes(entry.day),
  );
};

export const topTriggers = (entries: DiaryEntry[], limit = 3) => {
  const counts = new Map<string, { label: string; count: number }>();
  for (const entry of entries) {
    const label = entry.kind === 'ALLERGY' ? entry.trigger?.trim() : '';
    if (!label) continue;
    const key = label.toLowerCase();
    const current = counts.get(key);
    counts.set(key, { label: current?.label ?? label, count: (current?.count ?? 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
};

export const groupByDay = (entries: DiaryEntry[]) => {
  const days: { day: string; entries: DiaryEntry[] }[] = [];
  for (const entry of entries) {
    const last = days[days.length - 1];
    if (last?.day === entry.day) last.entries.push(entry);
    else days.push({ day: entry.day, entries: [entry] });
  }
  return days;
};
