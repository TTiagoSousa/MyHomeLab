import type { StressLevels } from '../../../../Hooks/Health/healthTypes';

export const LEVEL_ORDER: (keyof StressLevels)[] = ['relaxed', 'normal', 'medium', 'high'];

export const STRESS_COLORS = {
  line: '#a78bfa',
  area: 'rgba(167, 139, 250, 0.14)',
  range: 'rgba(167, 139, 250, 0.28)',
};

export const formatScore = (value: number | null | undefined, digits = 0) =>
  value == null ? '—' : value.toFixed(digits);

export const levelOf = (score: number): keyof StressLevels => {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 30) return 'normal';
  return 'relaxed';
};

export const levelsTotal = (levels: StressLevels) => LEVEL_ORDER.reduce((sum, key) => sum + (levels[key] ?? 0), 0);

export const levelShare = (levels: StressLevels, keys: (keyof StressLevels)[]) => {
  const total = levelsTotal(levels);
  return total ? Math.round((keys.reduce((sum, key) => sum + (levels[key] ?? 0), 0) / total) * 100) : null;
};

export const stressColumns = (t: (key: string) => string) => [
  { key: 'day', label: t('stress.columns.day') },
  { key: 'average', label: t('stress.columns.average') },
  { key: 'min', label: t('stress.columns.min') },
  { key: 'max', label: t('stress.columns.max') },
  { key: 'relaxed', label: t('stress.columns.relaxed'), optional: true },
  { key: 'stressed', label: t('stress.columns.stressed'), optional: true },
  { key: 'samples', label: t('stress.columns.samples'), optional: true },
  { key: 'levels', label: t('stress.columns.levels') },
];
