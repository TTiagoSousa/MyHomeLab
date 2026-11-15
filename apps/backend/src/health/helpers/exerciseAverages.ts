import { Workout } from 'src/generated/prisma/client/client';
import { HeartZoneSeconds } from '../huawei/parseHuaweiWorkouts';
import { mergeWorkoutParts } from './mergeWorkoutParts';

export interface ExerciseAverages {
  workouts: number;
  from: string | null;
  to: string | null;
  perWeek: number | null;
  totalMinutes: number;
  avgMinutes: number | null;
  totalCalories: number;
  totalDistanceM: number;
  avgHeartRate: number | null;
  intenseMinutes: number;
  longestMinutes: number | null;
  longestType: string | null;
  longestDay: string | null;
  peakHeartRate: number | null;
  peakDay: string | null;
  workoutsByType: Record<string, number>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const dayOf = (entry: Workout) => entry.day.toISOString().slice(0, 10);

/**
 * As médias de um período de treinos. Os treinos por semana dividem pelo
 * número de semanas do período (no mínimo uma); os minutos intensos somam o
 * tempo acima de 140 bpm (zonas "hard" e "peak"). Uma sessão (principal com
 * aquecimento, retorno à calma ou partes) conta como um só treino do tipo do
 * principal.
 */
export function exerciseAverages(
  allWorkouts: Workout[],
  periodDays: number,
): ExerciseAverages {
  const workouts = mergeWorkoutParts(allWorkouts);
  const sortedDays = workouts.map(dayOf).sort();
  const spanDays =
    periodDays > 0
      ? periodDays
      : sortedDays.length
        ? (Date.parse(sortedDays[sortedDays.length - 1]) -
            Date.parse(sortedDays[0])) /
            DAY_MS +
          1
        : 0;
  const weeks = Math.max(spanDays / 7, 1);

  const workoutsByType: Record<string, number> = {};
  let totalSeconds = 0;
  let intenseSeconds = 0;
  for (const workout of workouts) {
    workoutsByType[workout.typeId] = (workoutsByType[workout.typeId] ?? 0) + 1;
    totalSeconds += workout.durationSec;
    const zones = workout.heartZones as unknown as HeartZoneSeconds | null;
    intenseSeconds += (zones?.hard ?? 0) + (zones?.peak ?? 0);
  }

  const longest = workouts.reduce<Workout | null>(
    (top, workout) =>
      !top || workout.durationSec > top.durationSec ? workout : top,
    null,
  );
  const peak = workouts.reduce<Workout | null>(
    (top, workout) =>
      (workout.maxHeartRate ?? 0) > (top?.maxHeartRate ?? 0) ? workout : top,
    null,
  );
  const heartRates = workouts
    .map((workout) => workout.avgHeartRate)
    .filter((value): value is number => value != null);

  return {
    workouts: workouts.length,
    from: sortedDays[0] ?? null,
    to: sortedDays[sortedDays.length - 1] ?? null,
    perWeek: workouts.length
      ? Math.round((workouts.length / weeks) * 10) / 10
      : null,
    totalMinutes: Math.round(totalSeconds / 60),
    avgMinutes: workouts.length
      ? Math.round(totalSeconds / 60 / workouts.length)
      : null,
    totalCalories: workouts.reduce(
      (sum, workout) => sum + (workout.calories ?? 0),
      0,
    ),
    totalDistanceM: workouts.reduce(
      (sum, workout) => sum + (workout.distanceM ?? 0),
      0,
    ),
    avgHeartRate: heartRates.length
      ? Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length)
      : null,
    intenseMinutes: Math.round(intenseSeconds / 60),
    longestMinutes: longest ? Math.round(longest.durationSec / 60) : null,
    longestType: longest?.typeId ?? null,
    longestDay: longest ? dayOf(longest) : null,
    peakHeartRate: peak?.maxHeartRate ?? null,
    peakDay: peak ? dayOf(peak) : null,
    workoutsByType,
  };
}
