import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AppLocationDto } from './app-location.dto';

export class CreateStirlingAccountDto extends AppLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  /** O endereço do Stirling-PDF, ex.: https://pdf.exemplo.com */
  @IsUrl({ require_tld: false })
  baseUrl: string;

  /**
   * A chave de API da conta (Definições da conta → Chave de API) ou a global do servidor
   * (SECURITY_CUSTOMGLOBALAPIKEY). De um administrador chega também às definições.
   */
  @IsString()
  @MinLength(8)
  @MaxLength(400)
  apiKey: string;
}
