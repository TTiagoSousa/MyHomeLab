import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { MonitorKind } from 'src/generated/prisma/client/client';

export class SaveServiceMonitorDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsEnum(MonitorKind)
  kind!: MonitorKind;

  /** URL para HTTP (https://…) ou host:porta para TCP. */
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  target!: string;

  @IsInt()
  @Min(1)
  @Max(1440)
  intervalMinutes!: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  serverConnectionId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  guestVmid?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  guestName?: string | null;
}
