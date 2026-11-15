import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AppLocationDto } from './app-location.dto';

export class CreateHomeAssistantAccountDto extends AppLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  /** O endereço do Home Assistant, ex.: http://homeassistant.local:8123 */
  @IsUrl({ require_tld: false })
  baseUrl: string;

  /** Um token de acesso de longa duração (Perfil → Segurança), de um administrador. */
  @IsString()
  @MinLength(1)
  token: string;
}
