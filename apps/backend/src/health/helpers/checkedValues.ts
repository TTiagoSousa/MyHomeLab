import { BadRequestException } from '@nestjs/common';
import { FIELD_LIMITS, type HealthFormField } from './healthMetrics';
import { roundTo } from './readings';

/**
 * Os valores que vieram preenchidos, arredondados e dentro dos limites; um
 * valor fora dos limites é erro (diz qual).
 */
export function checkedValues<Field extends HealthFormField>(
  fields: readonly Field[],
  input: Partial<Record<Field, number | null | undefined>>,
): Partial<Record<Field, number>> {
  const values: Partial<Record<Field, number>> = {};
  for (const field of fields) {
    const value = input[field];
    if (value == null) continue;
    const { min, max, decimals } = FIELD_LIMITS[field];
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new BadRequestException({
        code: 'HEALTH_VALUE_RANGE',
        message: `O valor de ${field} tem de estar entre ${min} e ${max}.`,
      });
    }
    values[field] = roundTo(value, decimals);
  }
  return values;
}
