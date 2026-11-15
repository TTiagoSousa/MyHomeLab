import { ActivityDay } from 'src/generated/prisma/client/client';

export interface StepsLevels {
  low: number;
  some: number;
  active: number;
  goal: number;
}

export interface StepsAverages {
  days: number;
  from: string | null;
  to: string | null;
  steps: number | null;
  distanceM: number | null;
  calories: number | null;
  activeMinutes: number | null;
  bestDay: string | null;
  bestSteps: number | null;
  goalDays: number;
  totalSteps: number;
  totalDistanceM: number;
  levels: StepsLevels;
}

/** O objetivo diário de passos. */
export const STEP_GOAL = 10_000;

/** Os dias por faixa de passos: abaixo de 5 000, até 7 499, até 9 999 e o objetivo. */
const LEVEL_LIMITS = { some: 5_000, active: 7_500, goal: STEP_GOAL };

const levelOf = (steps: number): keyof StepsLevels => {
  if (steps >= LEVEL_LIMITS.goal) return 'goal';
  if (steps >= LEVEL_LIMITS.active) return 'active';
  if (steps >= LEVEL_LIMITS.some) return 'some';
  return 'low';
};

const average = (values: number[]) =>
  values.length
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : null;

const dayOf = (entry: ActivityDay) => entry.day.toISOString().slice(0, 10);

/**
 * As médias de um período de passos: passos, distância, calorias ativas e
 * minutos ativos por dia, o melhor dia, os totais e quantos dias caem em
 * cada faixa (o objetivo é a última).
 */
export function stepsAverages(entries: ActivityDay[]): StepsAverages {
  const levels: StepsLevels = { low: 0, some: 0, active: 0, goal: 0 };
  for (const entry of entries) levels[levelOf(entry.steps)]++;

  const best = entries.reduce<ActivityDay | null>(
    (top, entry) => (!top || entry.steps > top.steps ? entry : top),
    null,
  );
  const sortedDays = entries.map(dayOf).sort();

  return {
    days: entries.length,
    from: sortedDays[0] ?? null,
    to: sortedDays[sortedDays.length - 1] ?? null,
    steps: average(entries.map((entry) => entry.steps)),
    distanceM: average(entries.map((entry) => entry.distanceM)),
    calories: average(entries.map((entry) => entry.calories)),
    activeMinutes: average(entries.map((entry) => entry.activeMinutes)),
    bestDay: best ? dayOf(best) : null,
    bestSteps: best?.steps ?? null,
    goalDays: levels.goal,
    totalSteps: entries.reduce((sum, entry) => sum + entry.steps, 0),
    totalDistanceM: entries.reduce((sum, entry) => sum + entry.distanceM, 0),
    levels,
  };
}
