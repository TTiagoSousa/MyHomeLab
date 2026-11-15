import type { SleepStage } from '../../../../Hooks/Health/healthTypes';

export const STAGE_ORDER: SleepStage[] = ['AWAKE', 'REM', 'LIGHT', 'DEEP'];

export const STAGE_COLORS: Record<SleepStage, string> = {
  DEEP: '#4f46e5',
  LIGHT: '#60a5fa',
  REM: '#c084fc',
  AWAKE: '#f59e0b',
  NAP: '#34d399',
};

export const sleepColumns = (t: (key: string) => string) => [
  { key: 'night', label: t('sleep.columns.night') },
  { key: 'asleep', label: t('sleep.columns.asleep') },
  { key: 'wake', label: t('sleep.columns.wake') },
  { key: 'duration', label: t('sleep.columns.duration') },
  { key: 'deep', label: t('sleep.columns.deep'), optional: true },
  { key: 'light', label: t('sleep.columns.light'), optional: true },
  { key: 'rem', label: t('sleep.columns.rem'), optional: true },
  { key: 'awake', label: t('sleep.columns.awake'), optional: true },
  { key: 'stages', label: t('sleep.columns.stages') },
];
