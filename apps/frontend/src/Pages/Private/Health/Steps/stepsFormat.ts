import type { StepsLevels } from '../../../../Hooks/Health/healthTypes';

export const STEP_GOAL = 10_000;

export const LEVEL_ORDER: (keyof StepsLevels)[] = ['low', 'some', 'active', 'goal'];

export const STEPS_COLORS = {
  bar: '#34d399',
  goalBar: '#10b981',
  goal: '#f59e0b',
};

export const goalShare = (steps: number) => Math.min(Math.round((steps / STEP_GOAL) * 100), 999);

export const busiestHour = (hourly: number[] | null) => {
  if (!hourly?.length) return null;
  const max = Math.max(...hourly);
  return max > 0 ? hourly.indexOf(max) : null;
};

export const stepsColumns = (t: (key: string) => string) => [
  { key: 'day', label: t('steps.columns.day') },
  { key: 'steps', label: t('steps.columns.steps') },
  { key: 'goal', label: t('steps.columns.goal') },
  { key: 'distance', label: t('steps.columns.distance') },
  { key: 'calories', label: t('steps.columns.calories'), optional: true },
  { key: 'active', label: t('steps.columns.active'), optional: true },
  { key: 'pace', label: t('steps.columns.pace'), optional: true },
  { key: 'progress', label: t('steps.columns.progress') },
];
