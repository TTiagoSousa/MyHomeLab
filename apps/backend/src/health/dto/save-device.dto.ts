import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DEVICE_KINDS } from '../helpers/healthMetrics';

export class SaveDeviceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;

  @IsOptional()
  @IsIn([...DEVICE_KINDS])
  kind?: (typeof DEVICE_KINDS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  brand?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  model?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  brand?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  model?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
