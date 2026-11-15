import { HeartRateDay } from 'src/generated/prisma/client/client';
import { HeartZones } from '../huawei/parseHuaweiHeart';

export interface HeartAverages {
  days: number;
  from: string | null;
  to: string | null;
  restingBpm: number | null;
  restingMin: number | null;
  restingMax: number | null;
  avgBpm: number | null;
  minBpm: number | null;
  minDay: string | null;
  maxBpm: number | null;
  maxDay: string | null;
  avgHrv: number | null;
  samplesPerDay: number | null;
  zones: HeartZones;
}

const average = (values: (number | null)[]) => {
  const present = values.filter((entry): entry is number => entry != null);
  if (!present.length) return null;
  return Math.round(present.reduce((a, b) => a + b, 0) / present.length);
};

const dayOf = (entry: HeartRateDay) => entry.day.toISOString().slice(0, 10);

/**
 * As médias de um período de dias. O mínimo e o máximo são os extremos do
 * período (com o dia em que aconteceram); as zonas são a soma das leituras
 * de todos os dias, para dar a percentagem do período.
 */
export function heartAverages(entries: HeartRateDay[]): HeartAverages {
  const zones: HeartZones = { low: 0, normal: 0, elevated: 0, high: 0 };
  for (const entry of entries) {
    const dayZones = entry.zones as unknown as HeartZones;
    for (const key of Object.keys(zones) as (keyof HeartZones)[]) {
      zones[key] += dayZones?.[key] ?? 0;
    }
  }

  const sortedDays = entries.map(dayOf).sort();
  const lowest = entries.reduce<HeartRateDay | null>(
    (best, entry) => (!best || entry.minBpm < best.minBpm ? entry : best),
    null,
  );
  const highest = entries.reduce<HeartRateDay | null>(
    (best, entry) => (!best || entry.maxBpm > best.maxBpm ? entry : best),
    null,
  );
  const resting = entries
    .map((entry) => entry.restingBpm)
    .filter((value): value is number => value != null);

  return {
    days: entries.length,
    from: sortedDays[0] ?? null,
    to: sortedDays[sortedDays.length - 1] ?? null,
    restingBpm: average(resting),
    restingMin: resting.length ? Math.min(...resting) : null,
    restingMax: resting.length ? Math.max(...resting) : null,
    avgBpm: average(entries.map((entry) => entry.avgBpm)),
    minBpm: lowest?.minBpm ?? null,
    minDay: lowest ? dayOf(lowest) : null,
    maxBpm: highest?.maxBpm ?? null,
    maxDay: highest ? dayOf(highest) : null,
    avgHrv: average(entries.map((entry) => entry.avgHrv)),
    samplesPerDay: average(entries.map((entry) => entry.samples)),
    zones,
  };
}
