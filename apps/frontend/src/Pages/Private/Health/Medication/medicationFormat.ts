import type { Medication, MedicationKind, MedicationPayload } from '../../../../Hooks/Health/healthTypes';
import { dateLocale } from '../../../../i18n';
import { dateInput } from '../Shared/healthFormat';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const DAY_MS = 24 * 60 * 60 * 1000;

export const DOSE_UNITS = ['mg', 'g', 'mcg', 'ml', 'tablet', 'capsule', 'drops', 'iu'];

export const MEDICATION_KINDS: MedicationKind[] = ['MEDICATION', 'VITAMIN', 'SUPPLEMENT'];

export const medicationDetail = (medication: Pick<Medication, 'brand' | 'substance'>) =>
  [medication.substance, medication.brand].filter(Boolean).join(' · ');

export const formatDose = (t: Translate, medication: Pick<Medication, 'doseAmount' | 'doseUnit'>) => {
  if (medication.doseAmount == null) return medication.doseUnit ? t(`medication.units.${medication.doseUnit}`) : '—';
  return `${medication.doseAmount} ${medication.doseUnit ? t(`medication.units.${medication.doseUnit}`) : ''}`.trim();
};

export const formatFrequency = (t: Translate, medication: Pick<Medication, 'times' | 'timesPerDay'>) => {
  const perDay = medication.times.length || medication.timesPerDay;
  if (!perDay) return '—';
  const count = t('medication.perDay', { count: perDay });
  return medication.times.length ? `${count} · ${medication.times.join(', ')}` : count;
};

export const todayInput = () => dateInput(new Date());

export const isStillTaking = (medication: Pick<Medication, 'endDate'>) =>
  !medication.endDate || medication.endDate > todayInput();

export const formatFullDate = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString(dateLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);

export const takenDays = (startDate: string, endDate: string) => daysBetween(startDate, endDate) + 1;

export const formatAgo = (day: string) => {
  const days = daysBetween(day, todayInput());
  const format = new Intl.RelativeTimeFormat(dateLocale(), { numeric: 'auto' });
  if (Math.abs(days) < 14) return format.format(-days, 'day');
  if (Math.abs(days) < 60) return format.format(-Math.round(days / 7), 'week');
  if (Math.abs(days) < 730) return format.format(-Math.round(days / 30.44), 'month');
  return format.format(-Math.round(days / 365.25), 'year');
};

export const toPayload = (medication: Medication, changes: Partial<MedicationPayload> = {}): MedicationPayload => ({
  kind: medication.kind,
  name: medication.name,
  brand: medication.brand,
  substance: medication.substance,
  doseAmount: medication.doseAmount,
  doseUnit: medication.doseUnit,
  times: medication.times,
  timesPerDay: medication.timesPerDay,
  startDate: medication.startDate,
  endDate: medication.endDate,
  notes: medication.notes,
  conditionId: medication.condition?.id ?? null,
  ...changes,
});
