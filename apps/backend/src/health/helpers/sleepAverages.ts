import { SleepSession } from 'src/generated/prisma/client/client';
import { localMinute } from './timeZone';

export interface SleepAverages {
  nights: number;
  from: string | null;
  to: string | null;
  asleepMin: number | null;
  deepPct: number | null;
  lightPct: number | null;
  remPct: number | null;
  awakeMin: number | null;
  latencyMin: number | null;
  efficiency: number | null;
  bedtime: string | null;
  wakeTime: string | null;
  avgHeartRate: number | null;
  avgHrv: number | null;
  avgSpo2: number | null;
  avgBreathRate: number | null;
  naps: { count: number; avgMin: number | null };
}

const average = (values: (number | null)[], digits = 0) => {
  const present = values.filter((entry): entry is number => entry != null);
  if (!present.length) return null;
  const factor = 10 ** digits;
  return (
    Math.round((present.reduce((a, b) => a + b, 0) / present.length) * factor) /
    factor
  );
};

/**
 * A hora média de um relógio que passa a meia-noite: 23:30 e 00:30 têm de dar
 * 00:00, não 12:00. Conta-se a partir do meio-dia (as horas da manhã passam a
 * 24h+) e no fim volta-se ao relógio normal.
 */
const averageClock = (dates: Date[], timeZones: (string | null)[]) => {
  if (!dates.length) return null;
  const minutes = dates.map((date, index) => {
    const local = localMinute(date, timeZones[index]);
    return local < 720 ? local + 1440 : local;
  });
  const mean =
    Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length) % 1440;
  return `${String(Math.floor(mean / 60)).padStart(2, '0')}:${String(mean % 60).padStart(2, '0')}`;
};

const percentOf = (part: number, total: number) =>
  total > 0 ? (part / total) * 100 : null;

/** As médias de um conjunto de sessões: as noites contam para tudo, as sestas à parte. */
export function sleepAverages(sessions: SleepSession[]): SleepAverages {
  const nights = sessions.filter((session) => !session.isNap);
  const naps = sessions.filter((session) => session.isNap);
  const staged = nights.filter(
    (night) => night.deepMin + night.lightMin + night.remMin > 0,
  );
  const days = nights
    .map((night) => night.night.toISOString().slice(0, 10))
    .sort();

  return {
    nights: nights.length,
    from: days[0] ?? null,
    to: days[days.length - 1] ?? null,
    asleepMin: average(nights.map((night) => night.asleepMin)),
    deepPct: average(
      staged.map((night) => percentOf(night.deepMin, night.asleepMin)),
    ),
    lightPct: average(
      staged.map((night) => percentOf(night.lightMin, night.asleepMin)),
    ),
    remPct: average(
      staged.map((night) => percentOf(night.remMin, night.asleepMin)),
    ),
    awakeMin: average(staged.map((night) => night.awakeMin)),
    latencyMin: average(nights.map((night) => night.latencyMin)),
    efficiency: average(nights.map((night) => night.efficiency)),
    bedtime: averageClock(
      nights.map((night) => night.asleepAt),
      nights.map((night) => night.timeZone),
    ),
    wakeTime: averageClock(
      nights.map((night) => night.wakeAt),
      nights.map((night) => night.timeZone),
    ),
    avgHeartRate: average(nights.map((night) => night.avgHeartRate)),
    avgHrv: average(nights.map((night) => night.avgHrv)),
    avgSpo2: average(nights.map((night) => night.avgSpo2)),
    avgBreathRate: average(
      nights.map((night) => night.avgBreathRate),
      1,
    ),
    naps: {
      count: naps.length,
      avgMin: average(naps.map((nap) => nap.asleepMin)),
    },
  };
}
