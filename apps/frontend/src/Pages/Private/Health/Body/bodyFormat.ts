import { dateLocale } from '../../../../i18n';
import type {
  BodyMeasurement,
  BodyMeasurementFields,
  GlucoseContext,
  PhotoPose,
  ProgressPhoto,
  VitalKind,
  VitalReading,
} from '../../../../Hooks/Health/healthLogTypes';

export type BodySection = 'measurements' | 'photos';
export type MeasurementField = keyof BodyMeasurementFields;
export type VitalLevel = 'low' | 'normal' | 'elevated' | 'altered' | 'high' | 'veryHigh' | 'lowGrade' | 'fever';

export const BODY_SECTIONS: BodySection[] = ['measurements', 'photos'];
export const PHOTO_POSES: PhotoPose[] = ['FRONT', 'SIDE', 'BACK'];
export const VITAL_KINDS: VitalKind[] = ['BLOOD_PRESSURE', 'GLUCOSE', 'TEMPERATURE'];
export const GLUCOSE_CONTEXTS: GlucoseContext[] = ['FASTING', 'BEFORE_MEAL', 'AFTER_MEAL', 'RANDOM'];
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const MEASUREMENT_FIELDS: { key: MeasurementField; unit: string; max: number }[] = [
  { key: 'waistCm', unit: 'cm', max: 300 },
  { key: 'chestCm', unit: 'cm', max: 300 },
  { key: 'armCm', unit: 'cm', max: 150 },
  { key: 'thighCm', unit: 'cm', max: 200 },
  { key: 'hipsCm', unit: 'cm', max: 300 },
  { key: 'neckCm', unit: 'cm', max: 100 },
];

export const BODY_COLORS = {
  line: '#22d3ee',
  area: 'rgba(34, 211, 238, 0.12)',
  systolic: '#f43f5e',
  diastolic: '#60a5fa',
  glucose: '#f59e0b',
  temperature: '#a78bfa',
};

export const unitOf = (field: MeasurementField) => MEASUREMENT_FIELDS.find((item) => item.key === field)?.unit ?? '';

const decimals = (value: number) => (Number.isInteger(value) ? 0 : 1);

export const formatMeasure = (value: number | null | undefined, unit: string) =>
  value == null ? '—' : `${value.toFixed(decimals(value))} ${unit}`;

export const formatMeasureChange = (delta: number | null | undefined, unit: string) => {
  if (delta == null) return '';
  const rounded = Math.round(delta * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(decimals(rounded))} ${unit}`;
};

export const changeClass = (delta: number | null | undefined) =>
  delta == null || Math.abs(delta) < 0.05 ? '' : delta > 0 ? 'up' : 'down';

export const previousValue = (measurements: BodyMeasurement[], index: number, field: MeasurementField) =>
  measurements.slice(index + 1).find((row) => row[field] != null)?.[field] ?? null;

export const measurementChange = (measurements: BodyMeasurement[], index: number, field: MeasurementField) => {
  const current = measurements[index][field];
  const previous = previousValue(measurements, index, field);
  return current == null || previous == null ? null : current - previous;
};

export const parseNumber = (text: string) => {
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
};

export const numberText = (value: number | null | undefined) => (value == null ? '' : String(value));

export const sortPhotos = (photos: ProgressPhoto[]) =>
  photos
    .slice()
    .sort((a, b) => b.day.localeCompare(a.day) || PHOTO_POSES.indexOf(a.pose) - PHOTO_POSES.indexOf(b.pose));

export const photoDays = (photos: ProgressPhoto[]) => [...new Set(sortPhotos(photos).map((photo) => photo.day))];

export const daysBetween = (from: string, to: string) =>
  Math.round(Math.abs(Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

export const formatFullDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString(dateLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

const bloodPressureLevel = (systolic: number, diastolic: number): VitalLevel => {
  if (systolic >= 140 || diastolic >= 90) return 'veryHigh';
  if (systolic >= 130 || diastolic >= 80) return 'high';
  if (systolic >= 120) return 'elevated';
  return 'normal';
};

const glucoseLevel = (value: number, context: GlucoseContext | null): VitalLevel => {
  if (value < 70) return 'low';
  if (context === 'FASTING' || context === 'BEFORE_MEAL') {
    if (value >= 126) return 'high';
    return value >= 100 ? 'altered' : 'normal';
  }
  if (value >= 200) return 'high';
  return value >= 140 ? 'altered' : 'normal';
};

const temperatureLevel = (value: number): VitalLevel => {
  if (value >= 38) return 'fever';
  return value >= 37.5 ? 'lowGrade' : 'normal';
};

export const vitalLevel = (reading: VitalReading): VitalLevel => {
  if (reading.kind === 'BLOOD_PRESSURE') return bloodPressureLevel(reading.value, reading.value2 ?? 0);
  if (reading.kind === 'GLUCOSE') return glucoseLevel(reading.value, reading.context);
  return temperatureLevel(reading.value);
};

export const levelTone = (level: VitalLevel) => {
  if (level === 'normal') return 'ok';
  if (level === 'elevated' || level === 'altered' || level === 'lowGrade') return 'warn';
  if (level === 'high' || level === 'low') return 'high';
  return 'danger';
};

export const formatVital = (reading: VitalReading) => {
  if (reading.kind === 'BLOOD_PRESSURE') return `${reading.value}/${reading.value2 ?? '—'} mmHg`;
  if (reading.kind === 'GLUCOSE') return `${reading.value} mg/dL`;
  return `${reading.value.toFixed(1)} °C`;
};
