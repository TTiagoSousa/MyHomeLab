import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AppLocationDto } from './app-location.dto';

export class CreateJellyfinAccountDto extends AppLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  /** O endereço do Jellyfin, ex.: https://jellyfin.exemplo.com */
  @IsUrl({ require_tld: false })
  baseUrl: string;

  /** A chave de API de Painel de controlo → Chaves de API (dá acesso de administrador). */
  @IsString()
  @MinLength(16)
  @MaxLength(200)
  apiKey: string;
}
