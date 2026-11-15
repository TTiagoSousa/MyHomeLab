import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SaveManualWorkoutDto {
  /** Um tipo de treino (desporto): treino de força, alongamentos, corrida… */
  @IsString()
  @MaxLength(50)
  typeId!: string;

  /** O início, como instante ISO (UTC). */
  @IsISO8601()
  startAt!: string;

  /** O fim, como instante ISO (UTC). Se vier, a duração sai daqui. */
  @IsOptional()
  @IsISO8601()
  endAt?: string | null;

  /** O fuso do browser no formato da Huawei ("+0100"), para o dia e a hora local. */
  @Matches(/^[+-]\d{4}$/)
  timeZone!: string;

  /** Opcional: num registo rápido (ex: umas flexões) pode não se saber. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMin?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  calories?: number | null;

  /** Quão difícil foi o treino, de 0 a 10. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  difficulty?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
