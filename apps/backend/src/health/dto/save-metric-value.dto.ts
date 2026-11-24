import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';

/** Um valor de uma métrica, metido na página dela (os limites estão em FIELD_LIMITS). */
export class SaveMetricValueDto {
  @IsNumber()
  value!: number;

  /** O aparelho (só nas medidas da balança); sem o campo usa-se o predefinido. */
  @IsOptional()
  @IsUUID()
  deviceId?: string | null;

  @IsISO8601()
  measuredAt!: string;

  @Matches(/^[+-]\d{4}$/)
  timeZone!: string;
}
