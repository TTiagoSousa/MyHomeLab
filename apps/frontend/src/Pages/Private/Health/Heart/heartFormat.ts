import type { HeartZones } from '../../../../Hooks/Health/healthTypes';

export const ZONE_ORDER: (keyof HeartZones)[] = ['low', 'normal', 'elevated', 'high'];

export const HEART_COLORS = {
  line: '#f43f5e',
  area: 'rgba(244, 63, 94, 0.14)',
  range: 'rgba(244, 63, 94, 0.28)',
  resting: '#60a5fa',
  hrv: '#c084fc',
};

export const zonesTotal = (zones: HeartZones) => ZONE_ORDER.reduce((sum, key) => sum + (zones[key] ?? 0), 0);

export const elevatedShare = (zones: HeartZones) => {
  const total = zonesTotal(zones);
  return total ? Math.round(((zones.elevated + zones.high) / total) * 100) : null;
};

export const heartColumns = (t: (key: string) => string) => [
  { key: 'day', label: t('heart.columns.day') },
  { key: 'resting', label: t('heart.columns.resting') },
  { key: 'average', label: t('heart.columns.average') },
  { key: 'min', label: t('heart.columns.min'), optional: true },
  { key: 'max', label: t('heart.columns.max'), optional: true },
  { key: 'hrv', label: t('heart.columns.hrv'), optional: true },
  { key: 'samples', label: t('heart.columns.samples') },
  { key: 'zones', label: t('heart.columns.zones') },
];
