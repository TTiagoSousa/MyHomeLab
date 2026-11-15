import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  AgentScheduleRepeat,
  DocLinkType,
} from 'src/generated/prisma/client/client';

export class SaveAgentScheduleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  agentKey?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  instruction?: string;

  @IsOptional()
  @IsEnum(AgentScheduleRepeat)
  repeat?: AgentScheduleRepeat;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  runAt?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  time?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(7)
  weekday?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(31)
  monthDay?: number | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  notify?: boolean;

  /** A resposta fica numa conversa nova do Jarvis. */
  @IsOptional()
  @IsBoolean()
  toChat?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(DocLinkType)
  linkType?: DocLinkType | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  targetId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  targetLabel?: string | null;
}

export class ListAgentSchedulesQueryDto {
  @IsOptional()
  @IsEnum(DocLinkType)
  linkType?: DocLinkType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetId?: string;
}

export class AgentSummaryQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from tem de ser AAAA-MM-DD' })
  from!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to tem de ser AAAA-MM-DD' })
  to!: string;
}
