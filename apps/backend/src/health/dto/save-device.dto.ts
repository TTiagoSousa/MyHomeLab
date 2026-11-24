import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SaveDeviceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;

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
  @IsBoolean()
  isDefault?: boolean;
}
