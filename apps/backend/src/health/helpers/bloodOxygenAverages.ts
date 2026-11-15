import { BloodOxygenDay } from 'src/generated/prisma/client/client';
import { BloodOxygenRanges } from '../huawei/parseHuaweiBloodOxygen';
import { roundTo } from './readings';

export interface BloodOxygenAverages {
  days: number;
  from: string | null;
  to: string | null;
  avgSpo2: number | null;
  nightAvg: number | null;
  minSpo2: number | null;
  minDay: string | null;
  maxSpo2: number | null;
  samplesPerDay: number | null;
  ranges: BloodOxygenRanges;
}

const average = (values: (number | null)[], digits = 1) => {
  const present = values.filter((entry): entry is number => entry != null);
  if (!present.length) return null;
  return roundTo(present.reduce((a, b) => a + b, 0) / present.length, digits);
};

const dayOf = (entry: BloodOxygenDay) => entry.day.toISOString().slice(0, 10);

/**
 * As médias de um período. O mínimo é o mais baixo do período (com o dia),
 * que é o valor que importa no oxigénio; as faixas somam as leituras de
 * todos os dias.
 */
export function bloodOxygenAverages(
  entries: BloodOxygenDay[],
): BloodOxygenAverages {
  const ranges: BloodOxygenRanges = { low: 0, reduced: 0, normal: 0, high: 0 };
  for (const entry of entries) {
    const dayRanges = entry.ranges as unknown as BloodOxygenRanges;
    for (const key of Object.keys(ranges) as (keyof BloodOxygenRanges)[]) {
      ranges[key] += dayRanges?.[key] ?? 0;
    }
  }

  const sortedDays = entries.map(dayOf).sort();
  const lowest = entries.reduce<BloodOxygenDay | null>(
    (best, entry) => (!best || entry.minSpo2 < best.minSpo2 ? entry : best),
    null,
  );

  return {
    days: entries.length,
    from: sortedDays[0] ?? null,
    to: sortedDays[sortedDays.length - 1] ?? null,
    avgSpo2: average(entries.map((entry) => entry.avgSpo2)),
    nightAvg: average(entries.map((entry) => entry.nightAvg)),
    minSpo2: lowest?.minSpo2 ?? null,
    minDay: lowest ? dayOf(lowest) : null,
    maxSpo2: entries.length
      ? Math.max(...entries.map((entry) => entry.maxSpo2))
      : null,
    samplesPerDay: average(
      entries.map((entry) => entry.samples),
      0,
    ),
    ranges,
  };
}
