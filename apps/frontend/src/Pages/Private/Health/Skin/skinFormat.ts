import type { SkinTemperatureRanges } from '../../../../Hooks/Health/healthTypes';

export const RANGE_ORDER: (keyof SkinTemperatureRanges)[] = ['cold', 'cool', 'normal', 'warm'];

export const SKIN_COLORS = {
  line: '#fb923c',
  area: 'rgba(251, 146, 60, 0.14)',
  range: 'rgba(251, 146, 60, 0.28)',
  night: '#818cf8',
};

export const formatTemp = (value: number | null | undefined) => (value == null ? '—' : `${value.toFixed(1)} °C`);

export const rangesTotal = (ranges: SkinTemperatureRanges) =>
  RANGE_ORDER.reduce((sum, key) => sum + (ranges[key] ?? 0), 0);

export const coldShare = (ranges: SkinTemperatureRanges) => {
  const total = rangesTotal(ranges);
  return total ? Math.round((ranges.cold / total) * 100) : null;
};

export const temperatureYMin = (value: { min: number }) => Math.floor(value.min) - 1;

export const skinColumns = (t: (key: string) => string) => [
  { key: 'day', label: t('skin.columns.day') },
  { key: 'night', label: t('skin.columns.night') },
  { key: 'average', label: t('skin.columns.average') },
  { key: 'min', label: t('skin.columns.min'), optional: true },
  { key: 'max', label: t('skin.columns.max'), optional: true },
  { key: 'spread', label: t('skin.columns.spread'), optional: true },
  { key: 'samples', label: t('skin.columns.samples') },
  { key: 'ranges', label: t('skin.columns.ranges') },
];
