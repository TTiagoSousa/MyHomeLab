import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AppLocationDto } from './app-location.dto';

export class CreateDispatcharrAccountDto extends AppLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  /** O endereço do Dispatcharr, ex.: https://tv.exemplo.com */
  @IsUrl({ require_tld: false })
  baseUrl: string;

  /** A chave de API pessoal de um administrador (o utilizador → API & XC → Gerar). */
  @IsString()
  @MinLength(10)
  @MaxLength(400)
  apiKey: string;
}
