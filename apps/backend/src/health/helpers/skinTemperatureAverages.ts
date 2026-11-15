import { SkinTemperatureDay } from 'src/generated/prisma/client/client';
import { SkinTemperatureRanges } from '../huawei/parseHuaweiSkinTemperature';
import { roundTo } from './readings';

export interface SkinTemperatureAverages {
  days: number;
  from: string | null;
  to: string | null;
  avgTemp: number | null;
  nightAvg: number | null;
  minTemp: number | null;
  minDay: string | null;
  maxTemp: number | null;
  maxDay: string | null;
  avgSpread: number | null;
  samplesPerDay: number | null;
  ranges: SkinTemperatureRanges;
}

const average = (values: (number | null)[], digits = 1) => {
  const present = values.filter((entry): entry is number => entry != null);
  if (!present.length) return null;
  return roundTo(present.reduce((a, b) => a + b, 0) / present.length, digits);
};

const dayOf = (entry: SkinTemperatureDay) =>
  entry.day.toISOString().slice(0, 10);

/**
 * As médias de um período. O mínimo e o máximo são os extremos do período
 * (com o dia); a amplitude é a média de (máximo − mínimo) de cada dia; as
 * faixas somam as leituras de todos os dias.
 */
export function skinTemperatureAverages(
  entries: SkinTemperatureDay[],
): SkinTemperatureAverages {
  const ranges: SkinTemperatureRanges = {
    cold: 0,
    cool: 0,
    normal: 0,
    warm: 0,
  };
  for (const entry of entries) {
    const dayRanges = entry.ranges as unknown as SkinTemperatureRanges;
    for (const key of Object.keys(ranges) as (keyof SkinTemperatureRanges)[]) {
      ranges[key] += dayRanges?.[key] ?? 0;
    }
  }

  const sortedDays = entries.map(dayOf).sort();
  const lowest = entries.reduce<SkinTemperatureDay | null>(
    (best, entry) => (!best || entry.minTemp < best.minTemp ? entry : best),
    null,
  );
  const highest = entries.reduce<SkinTemperatureDay | null>(
    (best, entry) => (!best || entry.maxTemp > best.maxTemp ? entry : best),
    null,
  );

  return {
    days: entries.length,
    from: sortedDays[0] ?? null,
    to: sortedDays[sortedDays.length - 1] ?? null,
    avgTemp: average(entries.map((entry) => entry.avgTemp)),
    nightAvg: average(entries.map((entry) => entry.nightAvg)),
    minTemp: lowest?.minTemp ?? null,
    minDay: lowest ? dayOf(lowest) : null,
    maxTemp: highest?.maxTemp ?? null,
    maxDay: highest ? dayOf(highest) : null,
    avgSpread: average(entries.map((entry) => entry.maxTemp - entry.minTemp)),
    samplesPerDay: average(
      entries.map((entry) => entry.samples),
      0,
    ),
    ranges,
  };
}
