import type { LabResult } from '../../../../Hooks/Health/healthTypes';

const formatNumber = (value: number) => String(Math.round(value * 1000) / 1000);

export const labNumber = formatNumber;

export const labName = (
  t: (key: string, options?: Record<string, unknown>) => string,
  result: Pick<LabResult, 'key' | 'name'>,
) => {
  const percent = result.key.endsWith('_pct');
  const base = result.key.replace(/_pct$/, '');
  const name = t(`labs.analytes.${base}`, { defaultValue: '' });
  if (!name) return result.name;
  return percent ? `${name} (%)` : name;
};

export const formatLabValue = (result: Pick<LabResult, 'value' | 'valueText' | 'unit'>) => {
  const shown = result.value != null ? formatNumber(result.value) : result.valueText;
  if (shown == null) return '—';
  return result.unit ? `${shown} ${result.unit}` : shown;
};

export const formatLabReference = (result: Pick<LabResult, 'refLow' | 'refHigh' | 'refText'>) => {
  if (result.refText) return result.refText;
  if (result.refLow != null && result.refHigh != null) return `${formatNumber(result.refLow)}-${formatNumber(result.refHigh)}`;
  if (result.refHigh != null) return `<${formatNumber(result.refHigh)}`;
  if (result.refLow != null) return `>${formatNumber(result.refLow)}`;
  return '—';
};

export const parseLabValue = (text: string) => {
  const trimmed = text.trim();
  const numeric = trimmed.replace(',', '.');
  if (/^-?\d+(\.\d+)?$/.test(numeric)) return { value: Number(numeric), valueText: null };
  return { value: null, valueText: trimmed || null };
};

export const parseLabReference = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return { refLow: null, refHigh: null, refText: null };
  const numbers = trimmed.replace(/,/g, '.');
  const range = numbers.match(/^(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)/);
  if (range) return { refLow: Number(range[1]), refHigh: Number(range[2]), refText: trimmed };
  const below = numbers.match(/^[<≤]\s*(-?\d+(?:\.\d+)?)/);
  if (below) return { refLow: null, refHigh: Number(below[1]), refText: trimmed };
  const above = numbers.match(/^[>≥]\s*(-?\d+(?:\.\d+)?)/);
  if (above) return { refLow: Number(above[1]), refHigh: null, refText: trimmed };
  return { refLow: null, refHigh: null, refText: trimmed };
};

export const valueInput = (result: Pick<LabResult, 'value' | 'valueText'>) =>
  result.value != null ? formatNumber(result.value) : (result.valueText ?? '');
