import { localDay } from '../helpers/timeZone';
import { OpenGymWorkout } from './openGymApi';

/** O fuso em que se mostram os treinos do openGym (a API só dá instantes). */
const OPENGYM_TIME_ZONE = 'Europe/Lisbon';

const LB_TO_KG = 0.45359237;

/** Mais do que isto entre duas séries já não é pausa (ficou parado ou esqueceu-se de marcar). */
const MAX_REST_SEC = 30 * 60;

/** O tipo de treino (desporto) em que caem os treinos do openGym. */
export const OPENGYM_SPORT = 'strength';

export interface OpenGymExerciseInfo {
  name: string;
  bodyPart: string | null;
  target: string | null;
  equipment: string | null;
}

/** Uma série feita, como fica guardada no treino. */
export interface WorkoutSetLog {
  warmup: boolean;
  reps: number | null;
  sec: number | null;
  weightKg: number | null;
  done: boolean;
  at: string | null;
  /**
   * O tempo desde a série anterior do mesmo exercício. Nas séries por tempo
   * desconta-se a duração da série; nas de repetições inclui o tempo a fazê-las
   * (o openGym só guarda quando se marcou cada série).
   */
  restSec: number | null;
  rir: number | null;
  rpe: number | null;
}

/** Um exercício de um treino do openGym, com o planeado e as séries feitas. */
export interface WorkoutExerciseLog {
  id: string;
  name: string | null;
  bodyPart: string | null;
  target: string | null;
  equipment: string | null;
  mode: 'reps' | 'time';
  planned: {
    sets: number | null;
    reps: number | null;
    sec: number | null;
    weightKg: number | null;
  } | null;
  sets: WorkoutSetLog[];
  record: boolean;
  topWeightKg: number | null;
}

const num = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** "+0100" para um instante, no fuso de Lisboa (hora de verão incluída). */
export function openGymTimeZone(ms: number) {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: OPENGYM_TIME_ZONE,
    timeZoneName: 'longOffset',
  })
    .formatToParts(new Date(ms))
    .find((part) => part.type === 'timeZoneName')?.value;
  const match = name?.match(/GMT([+-])(\d{2}):(\d{2})/);
  return match ? `${match[1]}${match[2]}${match[3]}` : '+0000';
}

/**
 * Converte um treino do openGym nos campos do Workout: as horas, a duração, o
 * nome da rotina, o volume e os exercícios com as séries e as pausas. Os pesos
 * passam a kg quando o openGym está em libras. Os nomes vêm do catálogo deles
 * (ou dos exercícios criados pelo utilizador).
 */
export function openGymWorkoutData(
  workout: OpenGymWorkout,
  unit: string | null | undefined,
  exercises: Map<string, OpenGymExerciseInfo>,
) {
  const toKg = (value: unknown) => {
    const weight = num(value);
    if (weight == null || weight <= 0) return null;
    return round(unit === 'lb' ? weight * LB_TO_KG : weight, 2);
  };
  const startMs = num(workout.start) ?? Date.parse(`${workout.d}T12:00:00Z`);
  const endMs = Math.max(num(workout.end) ?? startMs, startMs);
  const timeZone = openGymTimeZone(startMs);
  const records = new Set(workout.prs ?? []);

  const exerciseLogs: WorkoutExerciseLog[] = (workout.entries ?? []).map(
    (entry) => {
      const info = exercises.get(entry.id);
      const planned = entry.planned ?? entry.target ?? null;
      const mode =
        entry.target?.mode === 'time' ||
        (entry.target?.mode == null && num(planned?.sec) != null)
          ? 'time'
          : 'reps';
      let previousAt: number | null = null;
      const sets = (entry.sets ?? []).map((set) => {
        const at = num(set.at);
        const sec = num(set.sec);
        let restSec: number | null = null;
        if (at != null && previousAt != null) {
          const gap = Math.round((at - previousAt) / 1000 - (sec ?? 0));
          restSec = gap >= 0 && gap <= MAX_REST_SEC ? gap : null;
        }
        if (at != null) previousAt = at;
        return {
          warmup: Boolean(set.warmup || set.phase === 'warmup'),
          reps: num(set.r),
          sec,
          weightKg: toKg(set.w),
          done: set.done !== false,
          at: at != null ? new Date(at).toISOString() : null,
          restSec,
          rir: num(set.rir),
          rpe: num(set.rpe),
        };
      });
      const weights = sets
        .filter((set) => set.done && !set.warmup)
        .map((set) => set.weightKg ?? 0);
      const top = weights.length ? Math.max(...weights) : 0;
      return {
        id: entry.id,
        name: info?.name ?? null,
        bodyPart: info?.bodyPart ?? null,
        target: info?.target ?? null,
        equipment: info?.equipment ?? null,
        mode,
        planned: planned
          ? {
              sets: num(planned.sets),
              reps: num(planned.reps),
              sec: num(planned.sec),
              weightKg: toKg(planned.weight),
            }
          : null,
        sets,
        record: records.has(entry.id),
        topWeightKg: top > 0 ? top : null,
      };
    },
  );

  const volume = num(workout.vol);
  return {
    typeId: OPENGYM_SPORT,
    title: workout.name?.trim() || null,
    day: new Date(
      `${/^\d{4}-\d{2}-\d{2}$/.test(workout.d ?? '') ? workout.d : localDay(startMs, timeZone)}T00:00:00Z`,
    ),
    timeZone,
    startAt: new Date(startMs),
    endAt: new Date(endMs),
    durationSec: Math.round((endMs - startMs) / 1000),
    volumeKg: volume != null && volume > 0 ? (toKg(volume) ?? null) : null,
    exercises: exerciseLogs,
  };
}
