import {
  Reading,
  byDay,
  isReading,
  minutePoints,
  roundTo,
} from '../helpers/readings';

/**
 * O que o browser manda: as leituras do tipo 400012 (SKIN_TEMPERATURE) da
 * pasta "Health detail data", uma por minuto, já sem o resto do registo
 * (são ~180 MB em bruto e ~9 MB assim).
 */
export interface HuaweiSkinTemperaturePayload {
  skinTemperature: Reading[];
}

export interface SkinTemperatureRanges {
  cold: number;
  cool: number;
  normal: number;
  warm: number;
}

export interface ParsedSkinTemperatureDay {
  day: string;
  timeZone: string | null;
  avgTemp: number;
  minTemp: number;
  maxTemp: number;
  minAt: number;
  maxAt: number;
  nightAvg: number | null;
  samples: number;
  ranges: SkinTemperatureRanges;
  points: [number, number][];
}

/**
 * Faixas em °C. Abaixo de 32 é quase sempre o relógio fora do pulso ou a
 * pele fria; a pele de um pulso costuma andar entre os 33 e os 36.
 */
const RANGE_LIMITS = { cool: 32, normal: 34, warm: 36 };

/** A noite, em minutos do dia: das 00:00 às 06:00, quando a leitura é mais estável. */
const NIGHT_END = 6 * 60;

/** Os pontos do gráfico ficam em médias de 5 minutos: chega para ver o dia e pesa 5× menos. */
const BUCKET_MINUTES = 5;

const rangeOf = (temp: number): keyof SkinTemperatureRanges => {
  if (temp >= RANGE_LIMITS.warm) return 'warm';
  if (temp >= RANGE_LIMITS.normal) return 'normal';
  if (temp >= RANGE_LIMITS.cool) return 'cool';
  return 'cold';
};

const mean = (values: number[]) =>
  values.length
    ? roundTo(values.reduce((a, b) => a + b, 0) / values.length, 1)
    : null;

const buckets = (points: [number, number][]) => {
  const groups = new Map<number, number[]>();
  for (const [minute, temp] of points) {
    const start = minute - (minute % BUCKET_MINUTES);
    const list = groups.get(start);
    if (list) list.push(temp);
    else groups.set(start, [temp]);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([minute, temps]) => [minute, mean(temps)!] as [number, number]);
};

/**
 * Transforma as leituras soltas em dias: média, média da noite, mínimo e
 * máximo (com a hora), leituras por faixa e os pontos do gráfico.
 */
export function parseHuaweiSkinTemperature(
  payload: HuaweiSkinTemperaturePayload,
): ParsedSkinTemperatureDay[] {
  const readings = (payload?.skinTemperature ?? []).filter(isReading);

  const days: ParsedSkinTemperatureDay[] = [];
  for (const [day, dayReadings] of byDay(readings)) {
    const points = minutePoints(dayReadings, 1);
    if (!points.length) continue;

    const ranges: SkinTemperatureRanges = {
      cold: 0,
      cool: 0,
      normal: 0,
      warm: 0,
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
      avgTemp: mean(points.map((point) => point[1]))!,
      minTemp: min[1],
      maxTemp: max[1],
      minAt: min[0],
      maxAt: max[0],
      nightAvg: mean(
        points.filter((point) => point[0] < NIGHT_END).map((point) => point[1]),
      ),
      samples: points.length,
      ranges,
      points: buckets(points),
    });
  }

  return days.sort((a, b) => a.day.localeCompare(b.day));
}
