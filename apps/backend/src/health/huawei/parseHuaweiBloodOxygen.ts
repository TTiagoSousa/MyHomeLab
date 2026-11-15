import {
  Reading,
  byDay,
  isReading,
  minutePoints,
  roundTo,
} from '../helpers/readings';

/**
 * O que o browser manda: as leituras do tipo 400021 (BLOOD_OXYGEN_SATURATION,
 * valor {"spo2"}) da pasta "Health detail data". O tipo 16 traz exatamente as
 * mesmas leituras noutro formato ({"avgSaturation"}) e fica de fora.
 */
export interface HuaweiBloodOxygenPayload {
  bloodOxygen: Reading[];
}

export interface BloodOxygenRanges {
  low: number;
  reduced: number;
  normal: number;
  high: number;
}

export interface ParsedBloodOxygenDay {
  day: string;
  timeZone: string | null;
  avgSpo2: number;
  minSpo2: number;
  maxSpo2: number;
  minAt: number;
  maxAt: number;
  nightAvg: number | null;
  samples: number;
  ranges: BloodOxygenRanges;
  points: [number, number][];
}

/** Faixas em %: abaixo de 90 é baixo, 90–94 reduzido, 95–97 normal, 98 ou mais alto. */
const RANGE_LIMITS = { reduced: 90, normal: 95, high: 98 };

/** A noite, em minutos do dia: das 00:00 às 06:00. */
const NIGHT_END = 6 * 60;

const rangeOf = (spo2: number): keyof BloodOxygenRanges => {
  if (spo2 >= RANGE_LIMITS.high) return 'high';
  if (spo2 >= RANGE_LIMITS.normal) return 'normal';
  if (spo2 >= RANGE_LIMITS.reduced) return 'reduced';
  return 'low';
};

const mean = (values: number[]) =>
  values.length
    ? roundTo(values.reduce((a, b) => a + b, 0) / values.length, 1)
    : null;

/**
 * Transforma as leituras soltas em dias: média, média da noite, mínimo e
 * máximo (com a hora) e leituras por faixa. São poucas por dia (~20), por
 * isso ficam todas guardadas para o gráfico.
 */
export function parseHuaweiBloodOxygen(
  payload: HuaweiBloodOxygenPayload,
): ParsedBloodOxygenDay[] {
  const readings = (payload?.bloodOxygen ?? []).filter(
    (entry) => isReading(entry) && entry[1] <= 100,
  );

  const days: ParsedBloodOxygenDay[] = [];
  for (const [day, dayReadings] of byDay(readings)) {
    const points = minutePoints(dayReadings);
    if (!points.length) continue;

    const ranges: BloodOxygenRanges = {
      low: 0,
      reduced: 0,
      normal: 0,
      high: 0,
    };
    let min = points[0];
    let max = points[0];
    for (const point of points) {
      ranges[rangeOf(point[1])]++;
      if (point[1] < min[1]) min = point;
      if (point[1] > max[1]) max = point;
    }

    days.push({
      day,
      timeZone: dayReadings[dayReadings.length - 1][2] ?? null,
      avgSpo2: mean(points.map((point) => point[1]))!,
      minSpo2: min[1],
      maxSpo2: max[1],
      minAt: min[0],
      maxAt: max[0],
      nightAvg: mean(
        points.filter((point) => point[0] < NIGHT_END).map((point) => point[1]),
      ),
      samples: points.length,
      ranges,
      points,
    });
  }

  return days.sort((a, b) => a.day.localeCompare(b.day));
}
