import type { BloodOxygenRanges } from '../../../../Hooks/Health/healthTypes';

export const RANGE_ORDER: (keyof BloodOxygenRanges)[] = ['low', 'reduced', 'normal', 'high'];

export const OXYGEN_COLORS = {
  line: '#22d3ee',
  area: 'rgba(34, 211, 238, 0.12)',
  range: 'rgba(34, 211, 238, 0.28)',
  night: '#818cf8',
};

export const formatSpo2 = (value: number | null | undefined, digits = 0) =>
  value == null ? '—' : `${value.toFixed(digits)}%`;

export const rangesTotal = (ranges: BloodOxygenRanges) =>
  RANGE_ORDER.reduce((sum, key) => sum + (ranges[key] ?? 0), 0);

export const belowNormalShare = (ranges: BloodOxygenRanges) => {
  const total = rangesTotal(ranges);
  return total ? Math.round(((ranges.low + ranges.reduced) / total) * 100) : null;
};

export const oxygenYMin = (value: { min: number }) => Math.max(Math.floor(value.min) - 2, 0);

export const oxygenColumns = (t: (key: string) => string) => [
  { key: 'day', label: t('oxygen.columns.day') },
  { key: 'average', label: t('oxygen.columns.average') },
  { key: 'night', label: t('oxygen.columns.night') },
  { key: 'min', label: t('oxygen.columns.min') },
  { key: 'max', label: t('oxygen.columns.max'), optional: true },
  { key: 'below', label: t('oxygen.columns.below'), optional: true },
  { key: 'samples', label: t('oxygen.columns.samples'), optional: true },
  { key: 'ranges', label: t('oxygen.columns.ranges') },
];
