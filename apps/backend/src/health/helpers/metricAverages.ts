import { roundTo } from './readings';

export interface MetricPoint {
  day: string;
  at: Date;
  value: number;
}

export interface MetricAverages {
  entries: number;
  from: string | null;
  to: string | null;
  latest: number | null;
  latestDay: string | null;
  /** A diferença entre o último valor e o primeiro do período. */
  change: number | null;
  avg: number | null;
  min: number | null;
  minDay: string | null;
  max: number | null;
  maxDay: string | null;
}

/** As médias de um período de valores de uma métrica (por qualquer ordem). */
export function metricAverages(points: MetricPoint[]): MetricAverages {
  const sorted = [...points].sort((a, b) => a.at.getTime() - b.at.getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const min = sorted.reduce<MetricPoint | null>(
    (low, point) => (!low || point.value < low.value ? point : low),
    null,
  );
  const max = sorted.reduce<MetricPoint | null>(
    (high, point) => (!high || point.value > high.value ? point : high),
    null,
  );

  return {
    entries: sorted.length,
    from: first?.day ?? null,
    to: last?.day ?? null,
    latest: last?.value ?? null,
    latestDay: last?.day ?? null,
    change:
      first && last && sorted.length > 1
        ? roundTo(last.value - first.value, 1)
        : null,
    avg: sorted.length
      ? roundTo(
          sorted.reduce((sum, point) => sum + point.value, 0) / sorted.length,
          1,
        )
      : null,
    min: min?.value ?? null,
    minDay: min?.day ?? null,
    max: max?.value ?? null,
    maxDay: max?.day ?? null,
  };
}
