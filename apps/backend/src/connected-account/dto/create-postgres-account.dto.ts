import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AppLocationDto } from './app-location.dto';

export class CreatePostgresAccountDto extends AppLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  /** O host do próprio servidor PostgreSQL (ex.: 10.0.0.20 ou db.exemplo.com), não o pgAdmin. */
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  host: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  /** A base de dados a que se liga (omissão: postgres). */
  @IsOptional()
  @IsString()
  @MaxLength(63)
  database?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(63)
  username: string;

  @IsString()
  @MinLength(1)
  @MaxLength(400)
  password: string;

  /** off = sem TLS; on = TLS com o certificado verificado; no-verify = TLS sem verificar. */
  @IsOptional()
  @IsIn(['off', 'on', 'no-verify'])
  ssl?: 'off' | 'on' | 'no-verify';
}
