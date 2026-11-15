import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class LabResultDto {
  /** Chave normalizada; se faltar, faz-se a partir do nome. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  key?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  section?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  group?: string | null;

  @IsOptional()
  @IsNumber()
  value?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  valueText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string | null;

  @IsOptional()
  @IsNumber()
  refLow?: number | null;

  @IsOptional()
  @IsNumber()
  refHigh?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  refText?: string | null;

  @IsOptional()
  @IsIn(['ABNORMAL', null])
  flag?: string | null;
}

export class SaveLabReportDto {
  /** Data da colheita, AAAA-MM-DD. */
  @IsDateString()
  collectedAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lab?: string | null;

  @IsIn(['PDF', 'MANUAL'])
  source!: 'PDF' | 'MANUAL';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => LabResultDto)
  results!: LabResultDto[];
}
