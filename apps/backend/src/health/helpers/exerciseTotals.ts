import { Workout } from 'src/generated/prisma/client/client';
import { WorkoutExerciseLog } from '../opengym/openGymWorkoutData';

export interface ExerciseTotal {
  id: string;
  name: string | null;
  workouts: number;
  /** Séries feitas, sem as de aquecimento. */
  sets: number;
  reps: number;
  seconds: number;
  maxWeightKg: number | null;
  records: number;
}

/**
 * Os totais de cada exercício num período (dos treinos do openGym): em quantos
 * treinos entrou, as séries feitas, a soma das repetições e dos segundos, o
 * peso mais alto e quantos recordes.
 */
export function exerciseTotals(
  workouts: Pick<Workout, 'id' | 'exercises'>[],
): ExerciseTotal[] {
  const totals = new Map<string, ExerciseTotal & { workoutIds: Set<string> }>();
  for (const workout of workouts) {
    if (!Array.isArray(workout.exercises)) continue;
    for (const exercise of workout.exercises as unknown as WorkoutExerciseLog[]) {
      const entry = totals.get(exercise.id) ?? {
        id: exercise.id,
        name: exercise.name,
        workouts: 0,
        sets: 0,
        reps: 0,
        seconds: 0,
        maxWeightKg: null,
        records: 0,
        workoutIds: new Set<string>(),
      };
      entry.workoutIds.add(workout.id);
      entry.name ??= exercise.name;
      if (exercise.record) entry.records++;
      for (const set of exercise.sets) {
        if (!set.done || set.warmup) continue;
        entry.sets++;
        entry.reps += set.reps ?? 0;
        entry.seconds += set.sec ?? 0;
        if (set.weightKg != null && set.weightKg > (entry.maxWeightKg ?? 0)) {
          entry.maxWeightKg = set.weightKg;
        }
      }
      totals.set(exercise.id, entry);
    }
  }
  return [...totals.values()]
    .map(({ workoutIds, ...total }) => ({
      ...total,
      workouts: workoutIds.size,
    }))
    .sort((a, b) => b.sets - a.sets);
}
