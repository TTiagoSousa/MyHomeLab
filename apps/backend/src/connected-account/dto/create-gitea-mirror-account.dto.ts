import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AppLocationDto } from './app-location.dto';

export class CreateGiteaMirrorAccountDto extends AppLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  /** O endereço do Gitea Mirror, ex.: https://mirror.exemplo.com */
  @IsUrl({ require_tld: false })
  baseUrl: string;

  /** A chave de API ("gm_…") de Configuração → Autenticação → Chaves de API. */
  @IsString()
  @MinLength(10)
  @MaxLength(400)
  apiKey: string;
}
