import { localDay } from '../helpers/timeZone';

/**
 * Um treino da pasta "Motion path detail data", como o browser o manda: o
 * summaryData tal e qual e só as linhas do detailData que interessam:
 * batimento "h-r", cadência "s-r", altitude "alti" e a rota GPS "lbs" (para o
 * mapa do treino).
 */
export interface HuaweiWorkoutRecord {
  recordId: string;
  startTime: number;
  endTime: number;
  timeZone?: string | null;
  summaryData: string;
  detail: string;
}

export interface HuaweiWorkoutsPayload {
  workouts: HuaweiWorkoutRecord[];
}

export interface HeartZoneSeconds {
  easy: number;
  moderate: number;
  hard: number;
  peak: number;
}

export interface ParsedWorkout {
  externalId: string;
  sportType: number;
  day: string;
  timeZone: string | null;
  startAt: Date;
  endAt: Date;
  durationSec: number;
  distanceM: number | null;
  calories: number | null;
  steps: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  minHeartRate: number | null;
  avgPace: number | null;
  bestPace: number | null;
  avgCadence: number | null;
  ascentM: number | null;
  descentM: number | null;
  trainingEffect: number | null;
  recoveryMin: number | null;
  heartZones: HeartZoneSeconds | null;
  heartRate: [number, number][] | null;
  cadence: [number, number][] | null;
  altitude: [number, number][] | null;
  route: [number, number][][] | null;
  splits: [number, number][] | null;
}

/** Zonas de esforço por batimento: abaixo de 120, até 139, até 159 e daí para cima. */
const ZONE_LIMITS = { moderate: 120, hard: 140, peak: 160 };

/** Os gráficos não precisam de mais pontos do que isto; as séries maiores fazem-se médias. */
const MAX_POINTS = 300;

/** O mapa não precisa de mais pontos do que isto; as rotas maiores ficam com um ponto em cada N. */
const MAX_ROUTE_POINTS = 800;

/** Acima disto o batimento não é real: a Huawei usa 255 para "sem leitura". */
const MAX_HEART_RATE = 240;

/** Entre duas leituras de batimento conta-se no máximo um minuto (pausas não somam tempo). */
const MAX_GAP_SECONDS = 60;

const positive = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;

const zoneOf = (bpm: number): keyof HeartZoneSeconds => {
  if (bpm >= ZONE_LIMITS.peak) return 'peak';
  if (bpm >= ZONE_LIMITS.hard) return 'hard';
  if (bpm >= ZONE_LIMITS.moderate) return 'moderate';
  return 'easy';
};

/** Lê as linhas "tp=h-r;k=<ms>;v=<valor>;" de um tipo, como [segundos desde o início, valor]. */
const series = (
  detail: string,
  type: string,
  startTime: number,
  maxValue = Infinity,
) => {
  const points: [number, number][] = [];
  const prefix = `tp=${type};`;
  for (const line of detail.split('\n')) {
    if (!line.startsWith(prefix)) continue;
    const time = Number(/;k=([\d.]+);/.exec(line)?.[1]);
    const value = Number(/;v=(-?[\d.]+);/.exec(line)?.[1]);
    if (
      !Number.isFinite(time) ||
      !Number.isFinite(value) ||
      value <= 0 ||
      value > maxValue
    )
      continue;
    const second = Math.round((time - startTime) / 1000);
    if (second >= 0) points.push([second, value]);
  }
  return points.sort((a, b) => a[0] - b[0]);
};

/** Reduz uma série a no máximo MAX_POINTS pontos, com a média de cada bloco. */
const downsample = (points: [number, number][], digits = 0) => {
  if (points.length <= MAX_POINTS) return points;
  const size = Math.ceil(points.length / MAX_POINTS);
  const factor = 10 ** digits;
  const result: [number, number][] = [];
  for (let index = 0; index < points.length; index += size) {
    const block = points.slice(index, index + size);
    const mean = block.reduce((sum, point) => sum + point[1], 0) / block.length;
    result.push([block[0][0], Math.round(mean * factor) / factor]);
  }
  return result;
};

const heartZones = (heartRate: [number, number][]) => {
  if (heartRate.length < 2) return null;
  const zones: HeartZoneSeconds = { easy: 0, moderate: 0, hard: 0, peak: 0 };
  for (let index = 1; index < heartRate.length; index++) {
    const gap = heartRate[index][0] - heartRate[index - 1][0];
    zones[zoneOf(heartRate[index - 1][1])] += Math.min(gap, MAX_GAP_SECONDS);
  }
  return zones;
};

/**
 * Lê as linhas "tp=lbs;k=<n>;lat=<graus>;lon=<graus>;…" da rota. A Huawei marca
 * as pausas (e o fim) com lat=90, lon=-80: aí a rota parte-se num novo
 * segmento, para o mapa não desenhar uma reta por cima da pausa.
 */
const route = (detail: string) => {
  const segments: [number, number][][] = [[]];
  for (const line of detail.split('\n')) {
    if (!line.startsWith('tp=lbs;')) continue;
    const lat = Number(/;lat=(-?[\d.E-]+);/.exec(line)?.[1]);
    const lon = Number(/;lon=(-?[\d.E-]+);/.exec(line)?.[1]);
    const valid =
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      Math.abs(lat) < 90 &&
      Math.abs(lon) <= 180 &&
      !(lat === 0 && lon === 0);
    if (valid) segments[segments.length - 1].push([lat, lon]);
    else if (segments[segments.length - 1].length) segments.push([]);
  }
  const kept = segments.filter((segment) => segment.length > 1);
  const total = kept.reduce((sum, segment) => sum + segment.length, 0);
  if (!total) return null;
  const step = Math.ceil(total / MAX_ROUTE_POINTS);
  const round = (value: number) => Math.round(value * 1e5) / 1e5;
  return kept.map((segment) =>
    segment
      .filter((_, index) => index % step === 0 || index === segment.length - 1)
      .map(([lat, lon]) => [round(lat), round(lon)] as [number, number]),
  );
};

/**
 * O tempo de cada km a partir do partTimeMap do resumo, que traz o tempo
 * acumulado (em segundos) ao fim de cada km: {"1.0": 984, "2.0": 2210}.
 */
const splits = (partTimeMap: unknown) => {
  if (!partTimeMap || typeof partTimeMap !== 'object') return null;
  const marks = Object.entries(partTimeMap as Record<string, unknown>)
    .map(([km, seconds]) => [Number(km), Number(seconds)])
    .filter(([km, seconds]) => Number.isInteger(km) && km > 0 && seconds > 0)
    .sort((a, b) => a[0] - b[0]);
  const result: [number, number][] = [];
  let previous = 0;
  for (const [km, seconds] of marks) {
    if (seconds > previous) result.push([km, Math.round(seconds - previous)]);
    previous = seconds;
  }
  return result.length ? result : null;
};

const orNull = <T>(points: T[]) => (points.length ? points : null);

/**
 * Lê o resumo de cada treino (summaryData: totalTime em ms, totalDistance em
 * m, totalCalories em cal, ritmos em s/km, creepingWave = subida) e as séries
 * do detalhe. O efeito de treino e a recuperação vêm de wearSportData
 * (etraining_effect em décimas, recovery_time em minutos).
 */
export function parseHuaweiWorkouts(
  payload: HuaweiWorkoutsPayload,
): ParsedWorkout[] {
  const workouts: ParsedWorkout[] = [];

  for (const record of payload?.workouts ?? []) {
    if (
      !record?.recordId ||
      typeof record.startTime !== 'number' ||
      typeof record.endTime !== 'number'
    )
      continue;
    let summary: Record<string, unknown>;
    try {
      summary = JSON.parse(record.summaryData) as Record<string, unknown>;
    } catch {
      continue;
    }

    const wear = (summary.wearSportData ?? {}) as Record<string, unknown>;
    const detail = typeof record.detail === 'string' ? record.detail : '';
    const heartRate = series(detail, 'h-r', record.startTime, MAX_HEART_RATE);
    const totalTime = positive(summary.totalTime);
    const effect = positive(wear.etraining_effect);

    workouts.push({
      externalId: record.recordId,
      sportType: Number(summary.sportType) || 0,
      day: localDay(record.startTime, record.timeZone),
      timeZone: record.timeZone ?? null,
      startAt: new Date(record.startTime),
      endAt: new Date(record.endTime),
      durationSec: Math.round(
        (totalTime ?? record.endTime - record.startTime) / 1000,
      ),
      distanceM: positive(summary.totalDistance),
      calories:
        positive(summary.totalCalories) != null
          ? Math.round((summary.totalCalories as number) / 1000)
          : null,
      steps: positive(summary.totalSteps),
      avgHeartRate: positive(summary.avgHeartRate),
      maxHeartRate: positive(summary.maxHeartRate),
      minHeartRate: positive(summary.minHeartRate),
      avgPace: positive(summary.avgPace),
      bestPace: positive(summary.bestPace),
      avgCadence: positive(summary.avgStepRate),
      ascentM: positive(summary.creepingWave),
      descentM: positive(summary.mTotalDescent),
      trainingEffect: effect != null ? effect / 10 : null,
      recoveryMin: positive(wear.recovery_time),
      heartZones: heartZones(heartRate),
      heartRate: orNull(downsample(heartRate)),
      cadence: orNull(downsample(series(detail, 's-r', record.startTime))),
      altitude: orNull(downsample(series(detail, 'alti', record.startTime), 1)),
      route: route(detail),
      splits: splits(summary.partTimeMap),
    });
  }

  return workouts.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}
