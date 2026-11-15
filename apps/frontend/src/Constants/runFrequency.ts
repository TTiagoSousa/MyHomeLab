import { RUN_FREQUENCIES, type RunFrequency } from '@myhomelab/shared';

export const FREQUENCY_OPTIONS: { value: RunFrequency; labelKey: string }[] = RUN_FREQUENCIES.map((value) => ({
  value,
  labelKey: `frequency:long.${value}`,
}));

export const FREQUENCY_SHORT: Record<RunFrequency, string> = Object.fromEntries(
  RUN_FREQUENCIES.map((value) => [value, `frequency:short.${value}`]),
) as Record<RunFrequency, string>;
