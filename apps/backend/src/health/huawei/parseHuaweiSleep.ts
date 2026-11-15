import { localDay } from '../helpers/timeZone';

/** Um registo da pasta "Sample sequence data" do export do Huawei Health. */
export interface HuaweiSampleRecord {
  type: number;
  recordId: string;
  startTime: number;
  endTime: number;
  timeZone?: string;
  summaryData?: string;
  detailData?: string;
}

export type SleepStage = 'DEEP' | 'LIGHT' | 'REM' | 'AWAKE' | 'NAP';

export interface ParsedSleepSession {
  externalId: string;
  isNap: boolean;
  night: string;
  timeZone: string | null;
  bedAt: Date | null;
  asleepAt: Date;
  wakeAt: Date;
  riseAt: Date | null;
  asleepMin: number;
  deepMin: number;
  lightMin: number;
  remMin: number;
  awakeMin: number;
  efficiency: number | null;
  latencyMin: number | null;
  deepContinuity: number | null;
  wakeCount: number | null;
  turnOverCount: number | null;
  snoreFreq: number | null;
  rdi: number | null;
  avgHeartRate: number | null;
  minHeartRate: number | null;
  maxHeartRate: number | null;
  avgHrv: number | null;
  avgBreathRate: number | null;
  avgSpo2: number | null;
  minSpo2: number | null;
  baseline: Record<string, [number, number]> | null;
  stages: { stage: SleepStage; start: string; minutes: number }[];
}

/** O tipo dos resumos de sessão de sono (TruSleep) no export. */
export const HUAWEI_SLEEP_SESSION_TYPE = 700013;

/**
 * Os códigos das fases no detailData. Confirmados contra os minutos por fase do
 * tipo 9 (PROFESSIONAL_SLEEP_*) das mesmas noites: os totais batem ao minuto.
 */
const STAGE_BY_CODE: Record<number, SleepStage> = {
  1: 'LIGHT',
  2: 'REM',
  3: 'DEEP',
  4: 'AWAKE',
  5: 'NAP',
};

/** A Huawei usa 255 (e 0 na pontuação das sestas) para "sem valor". */
const value = (raw: unknown, { zeroIsEmpty = false } = {}) => {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw === 255)
    return null;
  if (zeroIsEmpty && raw === 0) return null;
  return raw;
};

const seconds = (raw: unknown) =>
  typeof raw === 'number' && raw > 0 ? new Date(raw * 1000) : null;

/**
 * O detailData é hexadecimal: pares de inteiros de 32 bits little-endian
 * (duração em segundos, código da fase), pela ordem da noite.
 */
const decodeSegments = (hex: string | undefined) => {
  if (!hex || !/^[0-9a-f]+$/i.test(hex)) return [];
  const buffer = Buffer.from(hex, 'hex');
  const segments: { seconds: number; stage: SleepStage }[] = [];
  for (let offset = 0; offset + 8 <= buffer.length; offset += 8) {
    const stage = STAGE_BY_CODE[buffer.readInt32LE(offset + 4)];
    const length = buffer.readInt32LE(offset);
    if (stage && length > 0) segments.push({ seconds: length, stage });
  }
  return segments;
};

const range = (summary: Record<string, unknown>, name: string) => {
  const min = value(summary[`min${name}Baseline`]);
  const max = value(summary[`max${name}Baseline`]);
  return min != null && max != null ? ([min, max] as [number, number]) : null;
};

/**
 * Os registos 700013 do export são as sessões de sono já resumidas pela Huawei:
 * horas, pontuação, sinais do corpo e a sequência de fases. Tudo o resto do
 * export (os minutos do tipo 9, o SLEEP_RECORD com códigos internos) fica de
 * fora — isto basta e é a própria conta da Huawei.
 */
export function parseHuaweiSleep(
  records: HuaweiSampleRecord[],
): ParsedSleepSession[] {
  const sessions: ParsedSleepSession[] = [];

  for (const record of records) {
    if (record.type !== HUAWEI_SLEEP_SESSION_TYPE || !record.summaryData)
      continue;
    let summary: Record<string, unknown>;
    try {
      summary = JSON.parse(record.summaryData) as Record<string, unknown>;
    } catch {
      continue;
    }

    const asleepAt =
      seconds(summary.fallAsleepTime) ?? new Date(record.startTime);
    const wakeAt = seconds(summary.wakeupTime) ?? new Date(record.endTime);
    const segments = decodeSegments(record.detailData);
    const minutesOf = (stage: SleepStage) =>
      Math.round(
        segments
          .filter((segment) => segment.stage === stage)
          .reduce((total, segment) => total + segment.seconds, 0) / 60,
      );

    const isNap =
      segments.length > 0 &&
      segments.every((segment) => segment.stage === 'NAP');
    const deepMin = minutesOf('DEEP');
    const lightMin = minutesOf('LIGHT');
    const remMin = minutesOf('REM');
    const awakeMin = minutesOf('AWAKE');
    const asleepMin = isNap
      ? minutesOf('NAP')
      : deepMin + lightMin + remMin ||
        Math.round((wakeAt.getTime() - asleepAt.getTime()) / 60_000);

    // As fases acabam quando ele acorda: contam-se para trás a partir daí.
    const totalSeconds = segments.reduce(
      (total, segment) => total + segment.seconds,
      0,
    );
    let cursor = wakeAt.getTime() - totalSeconds * 1000;
    const stages = segments.map((segment) => {
      const start = new Date(cursor).toISOString();
      cursor += segment.seconds * 1000;
      return {
        stage: segment.stage,
        start,
        minutes: Math.round(segment.seconds / 60),
      };
    });

    const baseline = {
      heartRate: range(summary, 'Heartrate'),
      hrv: range(summary, 'Hrv'),
      breathRate: range(summary, 'Breathrate'),
      spo2: range(summary, 'OxygenSaturation'),
    };
    const hasBaseline = Object.values(baseline).some(Boolean);

    sessions.push({
      externalId: record.recordId,
      isNap,
      night: localDay(isNap ? asleepAt : wakeAt, record.timeZone),
      timeZone: record.timeZone ?? null,
      bedAt: seconds(summary.bedTime),
      asleepAt,
      wakeAt,
      riseAt: seconds(summary.risingTime),
      asleepMin,
      deepMin,
      lightMin,
      remMin,
      awakeMin,
      efficiency: isNap
        ? null
        : value(summary.sleepEfficiency, { zeroIsEmpty: true }),
      latencyMin: isNap ? null : value(summary.sleepLatency),
      deepContinuity: isNap ? null : value(summary.deepPart),
      wakeCount: isNap ? null : value(summary.wakeCount),
      turnOverCount: isNap ? null : value(summary.turnOverCount),
      snoreFreq: isNap ? null : value(summary.snoreFreq),
      rdi: isNap ? null : value(summary.rdi),
      avgHeartRate: value(summary.avgHeartrate, { zeroIsEmpty: true }),
      minHeartRate: value(summary.minHeartrate, { zeroIsEmpty: true }),
      maxHeartRate: value(summary.maxHeartrate, { zeroIsEmpty: true }),
      avgHrv: value(summary.avgHrv, { zeroIsEmpty: true }),
      avgBreathRate: value(summary.avgBreathrate, { zeroIsEmpty: true }),
      avgSpo2: value(summary.avgOxygenSaturation, { zeroIsEmpty: true }),
      minSpo2: value(summary.minOxygenSaturation, { zeroIsEmpty: true }),
      baseline: hasBaseline
        ? (Object.fromEntries(
            Object.entries(baseline).filter(([, entry]) => entry),
          ) as Record<string, [number, number]>)
        : null,
      stages,
    });
  }

  return sessions;
}
