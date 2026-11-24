import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;
/** Os suplementos e vitaminas ficam na medicação. */
export const INTAKE_KINDS = ['CAFFEINE', 'ALCOHOL'] as const;
export const PHOTO_POSES = ['FRONT', 'SIDE', 'BACK'] as const;
export const VITAL_KINDS = [
  'BLOOD_PRESSURE',
  'GLUCOSE',
  'TEMPERATURE',
] as const;
export const GLUCOSE_CONTEXTS = [
  'FASTING',
  'BEFORE_MEAL',
  'AFTER_MEAL',
  'RANDOM',
] as const;
export const SPECIALTIES = [
  'GENERAL',
  'DENTIST',
  'EYES',
  'DERMATOLOGY',
  'CARDIOLOGY',
  'ORTHOPEDICS',
  'PHYSIOTHERAPY',
  'PSYCHOLOGY',
  'OTHER',
] as const;
export const EXAM_KINDS = [
  'XRAY',
  'ULTRASOUND',
  'CT',
  'MRI',
  'ECG',
  'ENDOSCOPY',
  'OTHER',
] as const;
export const VISION_KINDS = ['GLASSES', 'CONTACTS'] as const;

const TIME_ZONE = /^[+-]\d{4}$/;

/** Os campos de quando: o instante ISO e o fuso do browser ("+0100"), para o dia local. */
class TimedDto {
  @IsISO8601()
  at!: string;

  @Matches(TIME_ZONE)
  timeZone!: string;
}

export class SaveMealDto extends TimedDto {
  @IsIn([...MEAL_TYPES])
  mealType!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  kcal?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(1000)
  proteinG?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(1000)
  carbsG?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(1000)
  fatG?: number | null;

  /** Os valores vieram da estimativa do Claude. */
  @IsOptional()
  @IsBoolean()
  estimated?: boolean;
}

export class EstimateMealDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string;
}

/** Os valores de uma dose (num item próprio) ou de um registo (os totais). */
class IntakeValuesDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  volumeMl?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(5000)
  caffeineMg?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(1000)
  alcoholG?: number | null;
}

/**
 * Um café ou uma bebida. Com `presetId` ou `itemId` os valores que não
 * vierem calculam-se a partir de uma dose × `quantity`; sem eles, é um registo
 * livre e leva `kind` e `name`. Os valores que vierem são sempre os totais.
 */
export class SaveIntakeDto extends IntakeValuesDto {
  @IsISO8601()
  at!: string;

  @Matches(TIME_ZONE)
  timeZone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  presetId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  itemId?: string | null;

  @IsOptional()
  @IsIn([...INTAKE_KINDS])
  kind?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.25)
  @Max(50)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

/** Um item próprio, com os valores de uma dose. */
export class SaveIntakeItemDto extends IntakeValuesDto {
  @IsIn([...INTAKE_KINDS])
  kind!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}

export class SaveIntakeSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2000)
  caffeineLimitMg?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(100)
  alcoholLimitWeek?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  hiddenPresets?: string[];
}

export class SaveBodyMeasurementDto {
  @IsDateString()
  day!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(10)
  @Max(300)
  waistCm?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(10)
  @Max(300)
  chestCm?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(5)
  @Max(150)
  armCm?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(10)
  @Max(200)
  thighCm?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(10)
  @Max(300)
  hipsCm?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(10)
  @Max(100)
  neckCm?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

/** Vem num multipart com a imagem, por isso os campos chegam como texto. */
export class SaveProgressPhotoDto {
  @IsDateString()
  day!: string;

  @IsIn([...PHOTO_POSES])
  pose!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class SaveVitalDto extends TimedDto {
  @IsIn([...VITAL_KINDS])
  kind!: string;

  /** Sistólica (mmHg), glicemia (mg/dL) ou temperatura (°C). */
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(20)
  @Max(600)
  value!: number;

  /** Diastólica (mmHg), só na tensão. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(20)
  @Max(200)
  value2?: number | null;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(250)
  pulse?: number | null;

  @IsOptional()
  @IsIn([...GLUCOSE_CONTEXTS, null])
  context?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class SaveMoodDto {
  @IsInt()
  @Min(1)
  @Max(5)
  mood!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  energy!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  motivation!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}

export class SaveHabitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  position?: number;
}

export class CheckHabitDto {
  @IsBoolean()
  done!: boolean;
}

export class SaveFastDto {
  @IsISO8601()
  startAt!: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string | null;

  @IsInt()
  @Min(1)
  @Max(168)
  targetHours!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class SaveAppointmentDto extends TimedDto {
  @IsIn([...SPECIALTIES])
  specialty!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  doctor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  place?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;

  @IsOptional()
  @IsDateString()
  followUpDate?: string | null;
}

export class SaveVaccineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  dose?: string | null;

  @IsOptional()
  @IsDateString()
  nextDueDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class SaveExamDto {
  @IsDateString()
  date!: string;

  @IsIn([...EXAM_KINDS])
  kind!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bodyPart?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  findings?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  summary?: string | null;
}

export class SaveIllnessDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  symptoms?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  medication?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class SaveVisionDto {
  @IsDateString()
  date!: string;

  @IsIn([...VISION_KINDS])
  kind!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-30)
  @Max(30)
  rightSphere?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-15)
  @Max(15)
  rightCylinder?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  rightAxis?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-30)
  @Max(30)
  leftSphere?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-15)
  @Max(15)
  leftCylinder?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  leftAxis?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(5)
  addition?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(40)
  @Max(80)
  pupillaryMm?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class SaveContactLensDto {
  @IsDateString()
  startDate!: string;

  @IsInt()
  @Min(1)
  @Max(365)
  replaceDays!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
