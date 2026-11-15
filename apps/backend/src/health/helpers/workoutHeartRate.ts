import { HeartRateDay } from 'src/generated/prisma/client/client';
import { offsetMinutes } from './timeZone';

export interface WorkoutHeartRate {
  heartRate: [number, number][];
  avg: number;
  min: number;
  max: number;
  zones: { easy: number; moderate: number; hard: number; peak: number };
}

/** As mesmas zonas dos treinos da Huawei: abaixo de 120, até 139, até 159 e daí para cima. */
const ZONE_LIMITS = { moderate: 120, hard: 140, peak: 160 };

/** Entre duas leituras do dia conta-se no máximo isto (o relógio não mede sempre ao minuto). */
const MAX_GAP_SECONDS = 300;

const zoneOf = (bpm: number) => {
  if (bpm >= ZONE_LIMITS.peak) return 'peak';
  if (bpm >= ZONE_LIMITS.hard) return 'hard';
  if (bpm >= ZONE_LIMITS.moderate) return 'moderate';
  return 'easy';
};

/**
 * O batimento importado (pontos por minuto do dia local) que cai dentro de um
 * treino manual, como [segundos desde o início, bpm], com a média, o mínimo, o
 * máximo e o tempo em cada zona. Sem leituras no intervalo devolve null.
 */
export function workoutHeartRate(
  workout: {
    startAt: Date;
    timeZone: string | null;
    durationSec: number;
  },
  days: Pick<HeartRateDay, 'day' | 'points'>[],
): WorkoutHeartRate | null {
  const localStart =
    workout.startAt.getTime() + offsetMinutes(workout.timeZone) * 60_000;
  const heartRate: [number, number][] = [];
  for (const row of days) {
    const points = Array.isArray(row.points)
      ? (row.points as [number, number][])
      : [];
    for (const [minute, bpm] of points) {
      const second = Math.round(
        (row.day.getTime() + minute * 60_000 - localStart) / 1000,
      );
      if (second >= 0 && second <= workout.durationSec && bpm > 0)
        heartRate.push([second, bpm]);
    }
  }
  if (!heartRate.length) return null;
  heartRate.sort((a, b) => a[0] - b[0]);

  const values = heartRate.map((point) => point[1]);
  const zones = { easy: 0, moderate: 0, hard: 0, peak: 0 };
  for (let index = 0; index < heartRate.length; index++) {
    const next = heartRate[index + 1]?.[0] ?? workout.durationSec;
    const gap = Math.min(next - heartRate[index][0], MAX_GAP_SECONDS);
    zones[zoneOf(heartRate[index][1])] += Math.max(gap, 0);
  }
  return {
    heartRate,
    avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    min: Math.min(...values),
    max: Math.max(...values),
    zones,
  };
}
