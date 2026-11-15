import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { RunFrequency } from 'src/generated/prisma/client/client';

export class UpdateConnectedAccountDto {
  @IsOptional()
  @IsEnum(RunFrequency)
  runFrequency?: RunFrequency;

  /** De quanto em quanto tempo se analisam os emails para propor regras; null desliga. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(RunFrequency)
  proposalFrequency?: RunFrequency | null;

  /** Implementar sozinha uma proposta em que não se mexeu ao fim de N dias; null = nunca. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(60)
  autoImplementProposalsAfterDays?: number | null;

  /** O servidor onde a app corre; null tira-o. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  serverConnectionId?: string | null;

  /** O CT/VM dentro desse servidor; null tira-o. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(100)
  @Max(999999999)
  guestVmid?: number | null;
}
