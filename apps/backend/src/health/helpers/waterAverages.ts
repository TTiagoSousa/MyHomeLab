import { WATER_GOAL_ML, WaterDay } from './waterDays';

export interface WaterAverages {
  days: number;
  from: string | null;
  to: string | null;
  /** Média dos dias com registos. */
  avgMl: number | null;
  goalMl: number;
  goalDays: number;
  bestDay: string | null;
  bestMl: number | null;
  totalMl: number;
}

/** As médias de um período de água, a partir dos totais por dia. */
export function waterAverages(days: WaterDay[]): WaterAverages {
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day));
  const best = sorted.reduce<WaterDay | null>(
    (top, day) => (!top || day.ml > top.ml ? day : top),
    null,
  );
  const totalMl = sorted.reduce((sum, day) => sum + day.ml, 0);

  return {
    days: sorted.length,
    from: sorted[0]?.day ?? null,
    to: sorted[sorted.length - 1]?.day ?? null,
    avgMl: sorted.length ? Math.round(totalMl / sorted.length) : null,
    goalMl: WATER_GOAL_ML,
    goalDays: sorted.filter((day) => day.ml >= WATER_GOAL_ML).length,
    bestDay: best?.day ?? null,
    bestMl: best?.ml ?? null,
    totalMl,
  };
}
