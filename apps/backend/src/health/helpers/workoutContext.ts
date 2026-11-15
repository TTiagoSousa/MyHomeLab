import {
  BloodOxygenDay,
  HeartRateDay,
  SkinTemperatureDay,
  StressDay,
  Workout,
} from 'src/generated/prisma/client/client';
import { roundTo } from './readings';
import { localDay, offsetMinutes } from './timeZone';

type DayPoints = { day: Date; points: unknown };

export interface WorkoutContextSummary {
  avg: number;
  min: number;
  max: number;
}

export interface WorkoutContext {
  restingBpm: number | null;
  skinTemperature: [number, number][] | null;
  bloodOxygen: [number, number][] | null;
  stress: [number, number][] | null;
  skinSummary: WorkoutContextSummary | null;
  oxygenSummary: WorkoutContextSummary | null;
  stressSummary: WorkoutContextSummary | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Os dias locais que o treino toca (normalmente um; dois se passar da meia-noite). */
export function workoutDays(workout: Workout): Date[] {
  const days = new Set([
    localDay(workout.startAt, workout.timeZone),
    localDay(workout.endAt, workout.timeZone),
  ]);
  return [...days].map((day) => new Date(`${day}T00:00:00Z`));
}

/**
 * Converte os pontos de uma métrica ([minuto do dia local, valor]) em
 * [segundos desde o início do treino, valor] e fica só com os que caem
 * dentro do treino.
 */
const withinWorkout = (workout: Workout, rows: DayPoints[]) => {
  const localStart =
    workout.startAt.getTime() + offsetMinutes(workout.timeZone) * 60_000;
  const result: [number, number][] = [];
  for (const row of rows) {
    const points = Array.isArray(row.points)
      ? (row.points as [number, number][])
      : [];
    for (const [minute, value] of points) {
      const second = Math.round(
        (row.day.getTime() + minute * 60_000 - localStart) / 1000,
      );
      if (second >= 0 && second <= workout.durationSec)
        result.push([second, value]);
    }
  }
  return result.length ? result.sort((a, b) => a[0] - b[0]) : null;
};

const summary = (points: [number, number][] | null, digits = 0) => {
  if (!points?.length) return null;
  const values = points.map((point) => point[1]);
  return {
    avg: roundTo(values.reduce((a, b) => a + b, 0) / values.length, digits),
    min: Math.min(...values),
    max: Math.max(...values),
  };
};

/**
 * O que as outras métricas mediram durante o treino: temperatura da pele,
 * oxigénio e stress (cortados ao intervalo do treino) e o batimento em
 * repouso desse dia, para comparar com o do treino.
 */
export function workoutContext(
  workout: Workout,
  rows: {
    heart: HeartRateDay[];
    skin: SkinTemperatureDay[];
    oxygen: BloodOxygenDay[];
    stress: StressDay[];
  },
): WorkoutContext {
  const skinTemperature = withinWorkout(workout, rows.skin);
  const bloodOxygen = withinWorkout(workout, rows.oxygen);
  const stress = withinWorkout(workout, rows.stress);
  const startDay = new Date(
    `${localDay(workout.startAt, workout.timeZone)}T00:00:00Z`,
  ).getTime();
  const heartDay = rows.heart.find(
    (entry) => Math.abs(entry.day.getTime() - startDay) < DAY_MS / 2,
  );

  return {
    restingBpm: heartDay?.restingBpm ?? null,
    skinTemperature,
    bloodOxygen,
    stress,
    skinSummary: summary(skinTemperature, 1),
    oxygenSummary: summary(bloodOxygen, 1),
    stressSummary: summary(stress),
  };
}
