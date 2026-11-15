import { WeightEntry } from 'src/generated/prisma/client/client';
import { roundTo } from './readings';

export interface WeightAverages {
  entries: number;
  from: string | null;
  to: string | null;
  latestKg: number | null;
  latestDay: string | null;
  /** A diferença entre a última pesagem e a primeira do período. */
  changeKg: number | null;
  avgKg: number | null;
  minKg: number | null;
  minDay: string | null;
  maxKg: number | null;
  maxDay: string | null;
}

const dayOf = (entry: WeightEntry) => entry.day.toISOString().slice(0, 10);

/** As médias de um período de pesagens (por qualquer ordem). */
export function weightAverages(entries: WeightEntry[]): WeightAverages {
  const sorted = [...entries].sort(
    (a, b) => a.measuredAt.getTime() - b.measuredAt.getTime(),
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const min = sorted.reduce<WeightEntry | null>(
    (low, entry) => (!low || entry.weightKg < low.weightKg ? entry : low),
    null,
  );
  const max = sorted.reduce<WeightEntry | null>(
    (high, entry) => (!high || entry.weightKg > high.weightKg ? entry : high),
    null,
  );

  return {
    entries: sorted.length,
    from: first ? dayOf(first) : null,
    to: last ? dayOf(last) : null,
    latestKg: last?.weightKg ?? null,
    latestDay: last ? dayOf(last) : null,
    changeKg:
      first && last && sorted.length > 1
        ? roundTo(last.weightKg - first.weightKg, 1)
        : null,
    avgKg: sorted.length
      ? roundTo(
          sorted.reduce((sum, entry) => sum + entry.weightKg, 0) /
            sorted.length,
          1,
        )
      : null,
    minKg: min?.weightKg ?? null,
    minDay: min ? dayOf(min) : null,
    maxKg: max?.weightKg ?? null,
    maxDay: max ? dayOf(max) : null,
  };
}
