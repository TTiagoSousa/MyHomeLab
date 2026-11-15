import type { HeartZoneSeconds, Workout, WorkoutExerciseLog, WorkoutPartRole, WorkoutSetLog } from '../../../../Hooks/Health/healthTypes';
import { formatDuration } from '../Shared/healthFormat';

export { formatDistance, formatSteps } from '../Shared/healthFormat';

export const EFFORT_ORDER: (keyof HeartZoneSeconds)[] = ['easy', 'moderate', 'hard', 'peak'];

export const EXERCISE_COLORS = {
  heart: '#f43f5e',
  heartArea: 'rgba(244, 63, 94, 0.12)',
  altitude: '#a78bfa',
  route: '#38bdf8',
  start: '#34d399',
  end: '#f43f5e',
};

export const CONTEXT_COLORS = {
  skin: '#fb923c',
  oxygen: '#22d3ee',
  stress: '#a78bfa',
};

export const SPORT_CLASSES = ['sport-0', 'sport-1', 'sport-2', 'sport-3', 'sport-4', 'sport-5'];

export const SPORT_COLORS = ['#34d399', '#f43f5e', '#60a5fa', '#f59e0b', '#a78bfa', '#22d3ee'];

export const rankSports = (counts: Record<string, number>) =>
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([typeId]) => typeId);

export const formatSeconds = (seconds: number | null | undefined) =>
  seconds == null ? '—' : formatDuration(seconds / 60);

export const formatWorkoutDuration = (seconds: number) => (seconds ? formatSeconds(seconds) : '—');

export const formatWeight = (kg: number) => `${kg} kg`;

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const formatRest = (seconds: number) =>
  seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} min`;

export const formatPace = (secondsPerKm: number | null | undefined) => {
  if (secondsPerKm == null) return '—';
  const rounded = Math.round(secondsPerKm);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')} /km`;
};

export const typeName = (t: (key: string) => string, typeId: string) => t(`exercise.types.${typeId}`);

export const exerciseName = (exercise: Pick<WorkoutExerciseLog, 'id' | 'name'>) => {
  const name = exercise.name ?? `#${exercise.id}`;
  return name.charAt(0).toUpperCase() + name.slice(1);
};

export const exerciseInfo = (exercise: WorkoutExerciseLog) =>
  [exercise.target ?? exercise.bodyPart, exercise.equipment].filter(Boolean).join(' · ');

export const workingSets = (exercise: WorkoutExerciseLog) => exercise.sets.filter((set) => set.done && !set.warmup);

export const setAmount = (t: Translate, set: Pick<WorkoutSetLog, 'reps' | 'sec'>) =>
  set.sec != null ? `${set.sec} ${t('exercise.units.seconds')}` : `${set.reps ?? '—'} ${t('exercise.units.reps')}`;

export const plannedText = (t: Translate, exercise: WorkoutExerciseLog) => {
  const planned = exercise.planned;
  if (!planned?.sets) return null;
  const amount = planned.sec != null ? `${planned.sec} ${t('exercise.units.seconds')}` : `${planned.reps ?? '—'}`;
  return `${planned.sets} × ${amount}${planned.weightKg ? ` · ${formatWeight(planned.weightKg)}` : ''}`;
};

export const WORKOUT_PART_ROLES: WorkoutPartRole[] = ['WARMUP', 'PART', 'COOLDOWN'];

export type SessionWorkout = Workout & { sessionParts: Workout[] };

const sumOrNull = (values: (number | null)[]) =>
  values.some((value) => value != null) ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;

const overlapsMain = (main: Workout, part: Workout) => {
  const partLength = Date.parse(part.endAt) - Date.parse(part.startAt);
  const overlap =
    Math.min(Date.parse(main.endAt), Date.parse(part.endAt)) - Math.max(Date.parse(main.startAt), Date.parse(part.startAt));
  return partLength > 0 && overlap >= partLength / 2;
};

export const toSessions = (workouts: Workout[]): SessionWorkout[] => {
  const ids = new Set(workouts.map((workout) => workout.id));
  const isPart = (workout: Workout) => Boolean(workout.parentId && ids.has(workout.parentId));
  return workouts
    .filter((workout) => !isPart(workout))
    .map((workout) => {
      const parts = workouts
        .filter((part) => part.parentId === workout.id)
        .sort((a, b) => a.startAt.localeCompare(b.startAt));
      if (!parts.length) return { ...workout, sessionParts: [] };
      const all = [workout, ...parts.filter((part) => !overlapsMain(workout, part))];
      return {
        ...workout,
        durationSec: all.reduce((sum, item) => sum + item.durationSec, 0),
        distanceM: sumOrNull(all.map((item) => item.distanceM)),
        calories: sumOrNull(all.map((item) => item.calories)),
        sessionParts: parts,
      };
    });
};

export const defaultPartRole = (main: Workout, part: Workout): WorkoutPartRole =>
  part.endAt <= main.startAt ? 'WARMUP' : part.startAt >= main.endAt ? 'COOLDOWN' : 'PART';

export const zonesTotal = (zones: HeartZoneSeconds | null) =>
  zones ? EFFORT_ORDER.reduce((sum, key) => sum + (zones[key] ?? 0), 0) : 0;

export const workoutColumns = (t: (key: string) => string) => [
  { key: 'date', label: t('exercise.columns.date') },
  { key: 'sport', label: t('exercise.columns.sport') },
  { key: 'duration', label: t('exercise.columns.duration') },
  { key: 'distance', label: t('exercise.columns.distance'), optional: true },
  { key: 'calories', label: t('exercise.columns.calories') },
  { key: 'avgHeart', label: t('exercise.columns.avgHeart'), optional: true },
  { key: 'maxHeart', label: t('exercise.columns.maxHeart'), optional: true },
  { key: 'effort', label: t('exercise.columns.effort') },
];
