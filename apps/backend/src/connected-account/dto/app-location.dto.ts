import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Onde corre uma app self-hosted, dito logo ao ligá-la (opcional). */
export class AppLocationDto {
  /** O servidor onde a app corre. */
  @IsOptional()
  @IsString()
  serverConnectionId?: string;

  /** O CT/VM dentro desse servidor. */
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(999999999)
  guestVmid?: number;
}
