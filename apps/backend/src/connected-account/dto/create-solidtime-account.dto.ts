import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AppLocationDto } from './app-location.dto';

export class CreateSolidtimeAccountDto extends AppLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  /** O endereço do solidtime, ex.: https://solidtime.exemplo.com */
  @IsUrl({ require_tld: false })
  baseUrl: string;

  /** O token pessoal de Perfil → Tokens da API (um JWT comprido). */
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  token: string;

  /** A organização (o nome), quando o utilizador está em mais do que uma. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  organization?: string;
}
