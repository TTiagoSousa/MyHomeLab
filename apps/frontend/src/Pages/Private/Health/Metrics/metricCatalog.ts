import type { CompositionField, DeviceKind, HealthFormField, HealthMetric, TapeField } from '../../../../Hooks/Health/healthTypes';
import type { VitalKind } from '../../../../Hooks/Health/healthLogTypes';

export interface FieldInfo {
  unit: string;
  min: number;
  max: number;
  decimals: number;
}

export const FIELD_INFO: Record<HealthFormField, FieldInfo> = {
  weightKg: { unit: 'kg', min: 20, max: 400, decimals: 1 },
  bmi: { unit: '', min: 10, max: 80, decimals: 1 },
  bodyFatPct: { unit: '%', min: 1, max: 75, decimals: 1 },
  fatMassKg: { unit: 'kg', min: 1, max: 250, decimals: 1 },
  subcutaneousFatPct: { unit: '%', min: 1, max: 70, decimals: 1 },
  visceralFat: { unit: '', min: 1, max: 60, decimals: 1 },
  musclePct: { unit: '%', min: 10, max: 95, decimals: 1 },
  muscleKg: { unit: 'kg', min: 5, max: 200, decimals: 1 },
  skeletalMusclePct: { unit: '%', min: 5, max: 80, decimals: 1 },
  skeletalMuscleKg: { unit: 'kg', min: 5, max: 150, decimals: 1 },
  bonePct: { unit: '%', min: 0.5, max: 20, decimals: 1 },
  boneKg: { unit: 'kg', min: 0.5, max: 15, decimals: 1 },
  leanKg: { unit: 'kg', min: 10, max: 300, decimals: 1 },
  bmrKcal: { unit: 'kcal', min: 500, max: 6000, decimals: 0 },
  waterPct: { unit: '%', min: 20, max: 85, decimals: 1 },
  waterKg: { unit: 'kg', min: 10, max: 250, decimals: 1 },
  proteinPct: { unit: '%', min: 3, max: 40, decimals: 1 },
  proteinKg: { unit: 'kg', min: 1, max: 80, decimals: 1 },
  waistCm: { unit: 'cm', min: 10, max: 300, decimals: 1 },
  chestCm: { unit: 'cm', min: 10, max: 300, decimals: 1 },
  armCm: { unit: 'cm', min: 5, max: 150, decimals: 1 },
  thighCm: { unit: 'cm', min: 10, max: 200, decimals: 1 },
  hipsCm: { unit: 'cm', min: 10, max: 300, decimals: 1 },
  neckCm: { unit: 'cm', min: 10, max: 100, decimals: 1 },
  waterMl: { unit: 'ml', min: 1, max: 5000, decimals: 0 },
};

export const COMPOSITION_METRICS: CompositionField[] = [
  'bmi',
  'bodyFatPct',
  'fatMassKg',
  'subcutaneousFatPct',
  'visceralFat',
  'musclePct',
  'muscleKg',
  'skeletalMusclePct',
  'skeletalMuscleKg',
  'bonePct',
  'boneKg',
  'leanKg',
  'bmrKcal',
  'waterPct',
  'waterKg',
  'proteinPct',
  'proteinKg',
];

export const TAPE_METRICS: TapeField[] = ['waistCm', 'chestCm', 'armCm', 'thighCm', 'hipsCm', 'neckCm'];

export const HEALTH_METRICS: HealthMetric[] = [...COMPOSITION_METRICS, ...TAPE_METRICS];

export const FORM_FIELD_GROUPS: { key: 'scale' | 'tape' | 'water'; fields: HealthFormField[] }[] = [
  { key: 'scale', fields: ['weightKg', ...COMPOSITION_METRICS] },
  { key: 'tape', fields: TAPE_METRICS },
  { key: 'water', fields: ['waterMl'] },
];

export const SCALE_FIELDS: HealthFormField[] = ['weightKg', ...COMPOSITION_METRICS];

export const DEVICE_KINDS: DeviceKind[] = ['SCALE', 'BLOOD_PRESSURE', 'GLUCOMETER', 'THERMOMETER', 'OXIMETER', 'OTHER'];

export const VITAL_DEVICE_KIND: Record<VitalKind, DeviceKind> = {
  BLOOD_PRESSURE: 'BLOOD_PRESSURE',
  GLUCOSE: 'GLUCOMETER',
  TEMPERATURE: 'THERMOMETER',
};

export const isHealthMetric = (value: string | undefined): value is HealthMetric =>
  !!value && (HEALTH_METRICS as string[]).includes(value);

export const isTapeMetric = (metric: HealthMetric): metric is TapeField => (TAPE_METRICS as string[]).includes(metric);

export const metricPath = (metric: HealthMetric) => `/MyHomeLab/Health/Metrics/${metric}`;

export const METRIC_COLORS = {
  line: '#34d399',
  area: 'rgba(52, 211, 153, 0.12)',
  average: '#94a3b8',
};

const withUnit = (text: string, unit: string) => (unit ? `${text} ${unit}` : text);

export const formatField = (field: HealthFormField, value: number | null | undefined) =>
  value == null ? '—' : withUnit(value.toFixed(FIELD_INFO[field].decimals), FIELD_INFO[field].unit);

export const formatFieldChange = (field: HealthFormField, value: number | null | undefined) => {
  if (value == null) return '—';
  const { decimals, unit } = FIELD_INFO[field];
  return withUnit(`${value > 0 ? '+' : ''}${value.toFixed(decimals)}`, unit);
};

export const parseField = (field: HealthFormField, text: string) => {
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) return null;
  const value = Number(trimmed);
  const { min, max } = FIELD_INFO[field];
  return Number.isFinite(value) && value >= min && value <= max ? value : Number.NaN;
};
