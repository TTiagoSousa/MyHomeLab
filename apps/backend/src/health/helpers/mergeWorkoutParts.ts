import { Workout } from 'src/generated/prisma/client/client';
import { HeartZoneSeconds } from '../huawei/parseHuaweiWorkouts';

const ZONES = ['easy', 'moderate', 'hard', 'peak'] as const;

const sumOrNull = (a: number | null, b: number | null) =>
  a == null && b == null ? null : (a ?? 0) + (b ?? 0);

/**
 * Uma parte que decorre ao mesmo tempo que o principal (ex: o treino do openGym
 * dentro da sessão de musculação que o relógio gravou) é o mesmo tempo visto de
 * outro lado: não se soma, senão a sessão contava a dobrar.
 */
export function overlapsMain(main: Workout, part: Workout) {
  const overlap =
    Math.min(main.endAt.getTime(), part.endAt.getTime()) -
    Math.max(main.startAt.getTime(), part.startAt.getTime());
  const partLength = part.endAt.getTime() - part.startAt.getTime();
  return partLength > 0 && overlap >= partLength / 2;
}

/**
 * Junta cada sessão num só treino: o principal fica com a duração, a
 * distância, as calorias, os passos e as zonas somados, o batimento médio
 * pesado pela duração e o máximo de todos, e vai do início do primeiro ao fim
 * do último. As partes que decorrem ao mesmo tempo que o principal não se
 * somam. As partes cujo principal não está na lista ficam sozinhas.
 */
export function mergeWorkoutParts(workouts: Workout[]): Workout[] {
  const ids = new Set(workouts.map((workout) => workout.id));
  const partsOf = new Map<string, Workout[]>();
  for (const workout of workouts) {
    if (!workout.parentId || !ids.has(workout.parentId)) continue;
    partsOf.set(workout.parentId, [
      ...(partsOf.get(workout.parentId) ?? []),
      workout,
    ]);
  }

  return workouts
    .filter((workout) => !workout.parentId || !ids.has(workout.parentId))
    .map((workout) => {
      const parts = partsOf.get(workout.id);
      if (!parts) return workout;
      const all = [
        workout,
        ...parts.filter((part) => !overlapsMain(workout, part)),
      ];
      const timed = all.filter((item) => item.avgHeartRate != null);
      const timedSeconds = timed.reduce(
        (sum, item) => sum + item.durationSec,
        0,
      );
      const zones = all.map(
        (item) => item.heartZones as unknown as HeartZoneSeconds | null,
      );
      const hasZones = zones.some(Boolean);
      return {
        ...workout,
        startAt: new Date(
          Math.min(
            ...[workout, ...parts].map((item) => item.startAt.getTime()),
          ),
        ),
        endAt: new Date(
          Math.max(...[workout, ...parts].map((item) => item.endAt.getTime())),
        ),
        durationSec: all.reduce((sum, item) => sum + item.durationSec, 0),
        distanceM: all.reduce<number | null>(
          (sum, item) => sumOrNull(sum, item.distanceM),
          null,
        ),
        calories: all.reduce<number | null>(
          (sum, item) => sumOrNull(sum, item.calories),
          null,
        ),
        steps: all.reduce<number | null>(
          (sum, item) => sumOrNull(sum, item.steps),
          null,
        ),
        avgHeartRate: timedSeconds
          ? Math.round(
              timed.reduce(
                (sum, item) => sum + item.avgHeartRate! * item.durationSec,
                0,
              ) / timedSeconds,
            )
          : (workout.avgHeartRate ??
            parts.find((part) => part.avgHeartRate != null)?.avgHeartRate ??
            null),
        maxHeartRate:
          Math.max(
            ...[workout, ...parts].map((item) => item.maxHeartRate ?? 0),
          ) || null,
        heartZones: hasZones
          ? Object.fromEntries(
              ZONES.map((zone) => [
                zone,
                zones.reduce((sum, item) => sum + (item?.[zone] ?? 0), 0),
              ]),
            )
          : workout.heartZones,
      };
    });
}
