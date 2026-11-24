import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { HEALTH_FORM_FIELDS } from '../helpers/healthMetrics';

export class SaveHealthFormDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(HEALTH_FORM_FIELDS.length)
  @IsIn([...HEALTH_FORM_FIELDS], { each: true })
  fields!: string[];
}

/** O que se meteu num formulário: { campo: valor } só com os campos do formulário. */
export class SubmitHealthFormDto {
  @IsObject()
  values!: Record<string, number | null>;

  /** O aparelho das medidas da balança; sem o campo usa-se o predefinido. */
  @IsOptional()
  @IsUUID()
  deviceId?: string | null;

  @IsISO8601()
  measuredAt!: string;

  @Matches(/^[+-]\d{4}$/)
  timeZone!: string;
}
