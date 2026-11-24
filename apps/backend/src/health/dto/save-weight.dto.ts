import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';

/**
 * Uma pesagem: o peso e/ou a composição corporal da balança. Os limites de cada
 * valor estão em FIELD_LIMITS (verificados no serviço).
 */
export class SaveWeightDto {
  @IsOptional()
  @IsNumber()
  weightKg?: number | null;

  @IsOptional()
  @IsNumber()
  bodyFatPct?: number | null;

  @IsOptional()
  @IsNumber()
  subcutaneousFatPct?: number | null;

  @IsOptional()
  @IsNumber()
  visceralFat?: number | null;

  @IsOptional()
  @IsNumber()
  muscleKg?: number | null;

  @IsOptional()
  @IsNumber()
  skeletalMusclePct?: number | null;

  @IsOptional()
  @IsNumber()
  boneKg?: number | null;

  @IsOptional()
  @IsNumber()
  leanKg?: number | null;

  @IsOptional()
  @IsNumber()
  bmrKcal?: number | null;

  @IsOptional()
  @IsNumber()
  waterPct?: number | null;

  @IsOptional()
  @IsNumber()
  proteinPct?: number | null;

  /** O aparelho; sem o campo usa-se o predefinido, com null fica sem aparelho. */
  @IsOptional()
  @IsUUID()
  deviceId?: string | null;

  /** Quando se pesou, como instante ISO (UTC). */
  @IsISO8601()
  measuredAt!: string;

  /** O fuso do browser no formato da Huawei ("+0100"), para o dia local. */
  @Matches(/^[+-]\d{4}$/)
  timeZone!: string;
}
