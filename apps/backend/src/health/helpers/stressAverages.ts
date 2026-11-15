import { StressDay } from 'src/generated/prisma/client/client';
import { StressLevels } from '../huawei/parseHuaweiStress';
import { roundTo } from './readings';

export interface StressAverages {
  days: number;
  from: string | null;
  to: string | null;
  avgScore: number | null;
  minScore: number | null;
  maxScore: number | null;
  maxDay: string | null;
  calmestDay: string | null;
  calmestAvg: number | null;
  samplesPerDay: number | null;
  levels: StressLevels;
}

const average = (values: number[], digits = 1) =>
  values.length
    ? roundTo(values.reduce((a, b) => a + b, 0) / values.length, digits)
    : null;

const dayOf = (entry: StressDay) => entry.day.toISOString().slice(0, 10);

/**
 * As médias de um período. No stress interessa o pico (o máximo, com o dia)
 * e o dia mais calmo (a média diária mais baixa); os níveis somam as
 * medições de todos os dias.
 */
export function stressAverages(entries: StressDay[]): StressAverages {
  const levels: StressLevels = { relaxed: 0, normal: 0, medium: 0, high: 0 };
  for (const entry of entries) {
    const dayLevels = entry.levels as unknown as StressLevels;
    for (const key of Object.keys(levels) as (keyof StressLevels)[]) {
      levels[key] += dayLevels?.[key] ?? 0;
    }
  }

  const sortedDays = entries.map(dayOf).sort();
  const highest = entries.reduce<StressDay | null>(
    (best, entry) => (!best || entry.maxScore > best.maxScore ? entry : best),
    null,
  );
  const calmest = entries.reduce<StressDay | null>(
    (best, entry) => (!best || entry.avgScore < best.avgScore ? entry : best),
    null,
  );

  return {
    days: entries.length,
    from: sortedDays[0] ?? null,
    to: sortedDays[sortedDays.length - 1] ?? null,
    avgScore: average(entries.map((entry) => entry.avgScore)),
    minScore: entries.length
      ? Math.min(...entries.map((entry) => entry.minScore))
      : null,
    maxScore: highest?.maxScore ?? null,
    maxDay: highest ? dayOf(highest) : null,
    calmestDay: calmest ? dayOf(calmest) : null,
    calmestAvg: calmest?.avgScore ?? null,
    samplesPerDay: average(
      entries.map((entry) => entry.samples),
      0,
    ),
    levels,
  };
}
