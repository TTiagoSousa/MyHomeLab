import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const DOSE_UNITS = [
  'mg',
  'g',
  'mcg',
  'ml',
  'tablet',
  'capsule',
  'drops',
  'iu',
] as const;

/** Medicamento, vitamina ou suplemento: tudo o que se toma fica na medicação. */
export const MEDICATION_KINDS = [
  'MEDICATION',
  'VITAMIN',
  'SUPPLEMENT',
] as const;

export const DIARY_KINDS = [
  'PAIN',
  'SYMPTOM',
  'ALLERGY',
  'DAY',
  'NOTE',
] as const;

export const BODY_AREAS = [
  'head',
  'neck',
  'shoulders',
  'chest',
  'back_upper',
  'back_lower',
  'abdomen',
  'arms',
  'hands',
  'hips',
  'legs',
  'knees',
  'feet',
  'teeth',
  'other',
] as const;

/** Onde se manifesta uma alergia. */
export const ALLERGY_AREAS = [
  'skin',
  'eyes',
  'nose',
  'throat',
  'mouth',
  'breathing',
  'stomach',
  'other',
] as const;

export const SEXES = ['MALE', 'FEMALE', 'OTHER'] as const;

export const BLOOD_TYPES = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
] as const;

/** Cada campo é opcional: o que não vem fica como está; null apaga. */
export class SaveHealthProfileDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(50)
  @Max(250)
  heightCm?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string | null;

  @IsOptional()
  @IsDateString()
  birthDate?: string | null;

  @IsOptional()
  @IsIn([...SEXES, null])
  sex?: string | null;

  @IsOptional()
  @IsIn([...BLOOD_TYPES, null])
  bloodType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  emergencyContact?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class SaveMedicationDto {
  @IsOptional()
  @IsIn(MEDICATION_KINDS)
  kind?: (typeof MEDICATION_KINDS)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string | null;

  /** O que tem (Vitamina D3, Paracetamol…). */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  substance?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(100000)
  doseAmount?: number | null;

  @IsOptional()
  @IsIn([...DOSE_UNITS, null])
  doseUnit?: string | null;

  /** Horas das tomas, "HH:MM". O número de tomas por dia sai daqui quando há horas. */
  @IsArray()
  @ArrayMaxSize(12)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { each: true })
  times!: string[];

  /** Para quando se toma sem hora certa (ex: 2 vezes por dia). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  timesPerDay?: number | null;

  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  /** A alergia ou doença do perfil para que se toma (null tira a ligação). */
  @IsOptional()
  @IsUUID()
  conditionId?: string | null;
}

export const CONDITION_KINDS = ['ALLERGY', 'CONDITION'] as const;

/** Ativa (sem tratamento), em tratamento, controlada ou tratada (resolvida). */
export const CONDITION_STATUSES = [
  'ACTIVE',
  'TREATING',
  'CONTROLLED',
  'RESOLVED',
] as const;

export const CONDITION_SEVERITIES = ['MILD', 'MODERATE', 'SEVERE'] as const;

export class SaveHealthConditionDto {
  @IsIn([...CONDITION_KINDS])
  kind!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsIn([...CONDITION_STATUSES])
  status!: string;

  @IsOptional()
  @IsIn([...CONDITION_SEVERITIES, null])
  severity?: string | null;

  @IsOptional()
  @IsDateString()
  since?: string | null;

  /** Só conta quando o estado é RESOLVED. */
  @IsOptional()
  @IsDateString()
  resolvedAt?: string | null;

  /** Alergias: o que provoca (comichão, falta de ar…). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reaction?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  treatment?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class SaveDiaryEntryDto {
  @IsISO8601()
  at!: string;

  /** O fuso do browser no formato da Huawei ("+0100"), para o dia local. */
  @Matches(/^[+-]\d{4}$/)
  timeZone!: string;

  @IsIn([...DIARY_KINDS])
  kind!: string;

  /** A zona da dor (BODY_AREAS) ou onde se manifestou a alergia (ALLERGY_AREAS). */
  @IsOptional()
  @IsIn([...new Set([...BODY_AREAS, ...ALLERGY_AREAS]), null])
  bodyArea?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  intensity?: number | null;

  /** A causa suspeita de uma alergia (marisco, pólen, um medicamento…). */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  trigger?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  text?: string | null;
}
