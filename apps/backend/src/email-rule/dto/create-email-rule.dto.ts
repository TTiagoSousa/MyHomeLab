import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  ConditionLogic,
  LabelMode,
  MailKind,
  MatchType,
} from 'src/generated/prisma/client/client';

export class EmailRuleLabelPathDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  path: string;

  @IsOptional()
  @IsEnum(LabelMode)
  labelMode?: LabelMode;
}

export class CreateEmailRuleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // --- Condições ---
  @IsOptional()
  @IsEnum(ConditionLogic)
  conditionLogic?: ConditionLogic;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fromContains?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjectContains?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeKeywords?: string[];

  @IsOptional()
  @IsEnum(MatchType)
  matchType?: MatchType;

  @IsOptional()
  @IsEnum(MailKind)
  mailKind?: MailKind;

  @IsOptional()
  @IsBoolean()
  hasAttachment?: boolean;

  // --- Ações imediatas ---
  @IsOptional()
  @IsBoolean()
  markAsRead?: boolean;

  @IsOptional()
  @IsBoolean()
  markAsImportant?: boolean;

  @IsOptional()
  @IsBoolean()
  markAsStarred?: boolean;

  // --- Controlo de execução ---
  @IsOptional()
  @IsBoolean()
  stopProcessing?: boolean;

  // --- Retenção no Inbox ---
  @IsOptional()
  @IsBoolean()
  removeFromInbox?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  removeFromInboxAfterDays?: number | null;

  @IsOptional()
  @IsBoolean()
  removeOnlyIfRead?: boolean;

  @IsOptional()
  @IsBoolean()
  markAsReadOnRemove?: boolean;

  // --- Expiração de Estrela / Importante ---
  @IsOptional()
  @IsInt()
  @Min(0)
  starredExpiresAfterDays?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  importantExpiresAfterDays?: number | null;

  @IsOptional()
  @IsBoolean()
  importantExpiresOnStar?: boolean;

  // --- Caminhos (cada um um percurso completo, ex: "Bancos/Revolut/Saída de dinheiro", com o seu próprio modo) ---
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmailRuleLabelPathDto)
  labelPaths?: EmailRuleLabelPathDto[];
}
