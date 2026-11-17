import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  BackupDestinationKind,
  BackupRetention,
  RunFrequency,
} from 'src/generated/prisma/client/client';

/** Pastas com "/" entre níveis, sem ".." nem caracteres que o Nextcloud recusa. */
const FOLDER_PATTERN = /^(?!.*(^|\/)\.\.?(\/|$))[^\\:*?"<>|]+$/;
const FOLDER_MESSAGE =
  'A pasta só pode ter nomes separados por "/", sem ".." nem \\ : * ? " < > |';

export class CreateBackupDestinationDto {
  /** NEXTCLOUD (por omissão) ou LOCAL — uma pasta no próprio servidor. */
  @IsOptional()
  @IsEnum(BackupDestinationKind)
  kind?: BackupDestinationKind;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  /** A conta Nextcloud de Apps ligadas; sem ela, url, utilizador e password. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  accountId?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/\S+$/, {
    message: 'O endereço tem de começar por http:// ou https://',
  })
  @MaxLength(255)
  url?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(FOLDER_PATTERN, { message: FOLDER_MESSAGE })
  folder?: string;
}

/** Na edição tudo é opcional; a password em branco mantém a guardada. */
export class UpdateBackupDestinationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;

  /** null passa a credenciais próprias. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  accountId?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/\S+$/, {
    message: 'O endereço tem de começar por http:// ou https://',
  })
  @MaxLength(255)
  url?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(FOLDER_PATTERN, { message: FOLDER_MESSAGE })
  folder?: string;
}

export class CreateBackupJobDto {
  /** A app ligada de onde vem o backup; sem ela, o backup do próprio MyHomeLab. */
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsUUID()
  destinationId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(FOLDER_PATTERN, { message: FOLDER_MESSAGE })
  folder!: string;

  @IsOptional()
  @IsEnum(RunFrequency)
  runFrequency?: RunFrequency;

  @IsOptional()
  @IsEnum(BackupRetention)
  retention?: BackupRetention;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  keepCount?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Opções que só uma app tem. */
  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;
}

export class UpdateBackupJobDto {
  @IsOptional()
  @IsUUID()
  destinationId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(FOLDER_PATTERN, { message: FOLDER_MESSAGE })
  folder?: string;

  @IsOptional()
  @IsEnum(RunFrequency)
  runFrequency?: RunFrequency;

  @IsOptional()
  @IsEnum(BackupRetention)
  retention?: BackupRetention;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  keepCount?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Opções que só uma app tem. */
  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;
}
