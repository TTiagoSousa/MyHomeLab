import {
  Reading,
  byDay,
  isReading,
  minutePoints,
  roundTo,
} from '../helpers/readings';

/**
 * O que o browser manda: as medições do tipo 500026 (STRESS, valor
 * {"stressScore"}) da pasta "Health detail data". O tipo 11 (STRESS_DATA) traz
 * as mesmas medições com o detalhe do algoritmo da Huawei e fica de fora.
 */
export interface HuaweiStressPayload {
  stress: Reading[];
}

export interface StressLevels {
  relaxed: number;
  normal: number;
  medium: number;
  high: number;
}

export interface ParsedStressDay {
  day: string;
  timeZone: string | null;
  avgScore: number;
  minScore: number;
  maxScore: number;
  minAt: number;
  maxAt: number;
  samples: number;
  levels: StressLevels;
  points: [number, number][];
}

/** Os níveis da própria Huawei: 1–29 relaxado, 30–59 normal, 60–79 médio, 80–99 alto. */
const LEVEL_LIMITS = { normal: 30, medium: 60, high: 80 };

const levelOf = (score: number): keyof StressLevels => {
  if (score >= LEVEL_LIMITS.high) return 'high';
  if (score >= LEVEL_LIMITS.medium) return 'medium';
  if (score >= LEVEL_LIMITS.normal) return 'normal';
  return 'relaxed';
};

/**
 * Transforma as medições soltas em dias: média, mínimo e máximo (com a hora)
 * e medições por nível. São poucas por dia (~20), por isso ficam todas
 * guardadas para o gráfico.
 */
export function parseHuaweiStress(
  payload: HuaweiStressPayload,
): ParsedStressDay[] {
  const readings = (payload?.stress ?? []).filter(
    (entry) => isReading(entry) && entry[1] < 100,
  );

  const days: ParsedStressDay[] = [];
  for (const [day, dayReadings] of byDay(readings)) {
    const points = minutePoints(dayReadings);
    if (!points.length) continue;

    const levels: StressLevels = { relaxed: 0, normal: 0, medium: 0, high: 0 };
    let total = 0;
    let min = points[0];
    let max = points[0];
    for (const point of points) {
      total += point[1];
      levels[levelOf(point[1])]++;
      if (point[1] < min[1]) min = point;
      if (point[1] > max[1]) max = point;
    }

    days.push({
      day,
      timeZone: dayReadings[dayReadings.length - 1][2] ?? null,
      avgScore: roundTo(total / points.length, 1),
      minScore: min[1],
      maxScore: max[1],
      minAt: min[0],
      maxAt: max[0],
      samples: points.length,
      levels,
      points,
    });
  }

  return days.sort((a, b) => a.day.localeCompare(b.day));
}
