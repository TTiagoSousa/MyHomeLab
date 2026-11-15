import { dateLocale } from '../../../../i18n';
import type { IntakeDay, IntakeEntry, IntakeKind, IntakePreset, IntakeValues } from '../../../../Hooks/Health/intakesTypes';
import { dateInput } from '../Shared/healthFormat';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const INTAKE_KINDS: IntakeKind[] = ['CAFFEINE', 'ALCOHOL'];

export const INTAKE_COLORS = {
  caffeine: '#b45309',
  alcohol: '#a855f7',
};

export const ETHANOL_DENSITY = 0.789;

export const STANDARD_DRINK_G = 10;

export const kindClass = (kind: IntakeKind) => kind.toLowerCase();

export const formatNumber = (value: number, digits = 1) =>
  value.toLocaleString(dateLocale(), { maximumFractionDigits: digits });

export const parseDecimal = (value: string) => {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : NaN;
};

export const numberField = (value: number | null | undefined) => (value == null ? '' : String(value));

export const roundTo = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export const alcoholFromAbv = (volumeMl: number, abv: number) => roundTo(volumeMl * (abv / 100) * ETHANOL_DENSITY, 1);

export const intakeName = (t: Translate, presetId: string | null, name: string) =>
  presetId ? t(`intakes.presets.${presetId}`, { defaultValue: name }) : name;

export const valuesLabel = (kind: IntakeKind, values: IntakeValues & { abv?: number | null }) => {
  const parts: string[] = [];
  if (values.volumeMl != null && values.volumeMl > 0) parts.push(`${formatNumber(values.volumeMl, 0)} ml`);
  if (kind === 'CAFFEINE' && values.caffeineMg != null) parts.push(`${formatNumber(values.caffeineMg, 0)} mg`);
  if (kind === 'ALCOHOL' && values.abv != null) parts.push(`${formatNumber(values.abv)}%`);
  if (kind === 'ALCOHOL' && values.alcoholG != null) parts.push(`${formatNumber(values.alcoholG)} g`);
  return parts.join(' · ');
};

export const formatDrinks = (t: Translate, drinks: number) =>
  t('intakes.drinksValue', { count: drinks, value: formatNumber(drinks) });

export const entriesByDay = (entries: IntakeEntry[]) => {
  const grouped = new Map<string, IntakeEntry[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.day) ?? [];
    list.push(entry);
    grouped.set(entry.day, list);
  }
  return grouped;
};

export const weekStart = (today: Date) => {
  const start = new Date(today);
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return dateInput(start);
};

export const weekDrinks = (days: IntakeDay[], today: Date) => {
  const from = weekStart(today);
  const to = dateInput(today);
  return days.filter((day) => day.day >= from && day.day <= to).reduce((sum, day) => sum + day.drinks, 0);
};

export const presetsOf = (presets: IntakePreset[], kind: IntakeKind) => presets.filter((preset) => preset.kind === kind);
