import { Reading, byDay, isReading, minutePoints } from '../helpers/readings';

export type HeartReading = Reading;

/**
 * O que o browser manda: só as leituras que interessam, já tiradas da pasta
 * "Health detail data" do export (são ~90 MB em bruto). O tipo 7 traz o
 * batimento minuto a minuto (DATA_POINT_DYNAMIC_HEARTRATE) e o batimento em
 * repouso (DATA_POINT_NEW_REST_HEARTRATE); o 500044 traz a VFC (RMSSD).
 */
export interface HuaweiHeartPayload {
  heartRate: HeartReading[];
  resting: HeartReading[];
  hrv: HeartReading[];
}

export interface HeartZones {
  low: number;
  normal: number;
  elevated: number;
  high: number;
}

export interface ParsedHeartDay {
  day: string;
  timeZone: string | null;
  avgBpm: number;
  minBpm: number;
  maxBpm: number;
  minAt: number;
  maxAt: number;
  restingBpm: number | null;
  avgHrv: number | null;
  samples: number;
  zones: HeartZones;
  points: [number, number][];
  hrvPoints: [number, number][] | null;
}

/** Limites das zonas, em bpm: abaixo de 60, até 99, até 139 e daí para cima. */
const ZONE_LIMITS = { normal: 60, elevated: 100, high: 140 };

const zoneOf = (bpm: number): keyof HeartZones => {
  if (bpm >= ZONE_LIMITS.high) return 'high';
  if (bpm >= ZONE_LIMITS.elevated) return 'elevated';
  if (bpm >= ZONE_LIMITS.normal) return 'normal';
  return 'low';
};

/**
 * Transforma as leituras soltas em dias: média, mínimo e máximo (com a hora),
 * o repouso (o último valor do dia — a Huawei vai-o recalculando), a VFC e as
 * leituras por zona. Os pontos ficam guardados para o gráfico do dia.
 */
export function parseHuaweiHeart(
  payload: HuaweiHeartPayload,
): ParsedHeartDay[] {
  const heartRate = (payload?.heartRate ?? []).filter(isReading);
  const resting = byDay((payload?.resting ?? []).filter(isReading));
  const hrv = byDay((payload?.hrv ?? []).filter(isReading));

  const days: ParsedHeartDay[] = [];
  for (const [day, readings] of byDay(heartRate)) {
    const points = minutePoints(readings);
    if (!points.length) continue;

    const zones: HeartZones = { low: 0, normal: 0, elevated: 0, high: 0 };
    let total = 0;
    let min = points[0];
    let max = points[0];
    for (const point of points) {
      total += point[1];
      zones[zoneOf(point[1])]++;
      if (point[1] < min[1]) min = point;
      if (point[1] > max[1]) max = point;
    }

    const restingOfDay = resting.get(day)?.sort((a, b) => a[0] - b[0]);
    const hrvPoints = hrv.has(day) ? minutePoints(hrv.get(day)!) : null;

    days.push({
      day,
      timeZone: readings[readings.length - 1][2] ?? null,
      avgBpm: Math.round(total / points.length),
      minBpm: min[1],
      maxBpm: max[1],
      minAt: min[0],
      maxAt: max[0],
      restingBpm: restingOfDay?.length
        ? Math.round(restingOfDay[restingOfDay.length - 1][1])
        : null,
      avgHrv: hrvPoints?.length
        ? Math.round(
            hrvPoints.reduce((sum, point) => sum + point[1], 0) /
              hrvPoints.length,
          )
        : null,
      samples: points.length,
      zones,
      points,
      hrvPoints: hrvPoints?.length ? hrvPoints : null,
    });
  }

  return days.sort((a, b) => a.day.localeCompare(b.day));
}
