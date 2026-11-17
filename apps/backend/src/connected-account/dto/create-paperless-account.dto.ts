import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';
import { AppLocationDto } from './app-location.dto';

export class CreatePaperlessAccountDto extends AppLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  /** O endereço do Paperless, ex.: https://paperless.exemplo.com */
  @IsUrl({ require_tld: false })
  baseUrl: string;

  /**
   * O token de Perfil → Token de autenticação da API. Age como o utilizador dele; de um
   * superutilizador chega também à configuração e ao estado do sistema.
   */
  @IsString()
  @MaxLength(200)
  @Matches(/^\s*[A-Za-z0-9]{20,}\s*$/, {
    message: 'O token do Paperless tem só letras e números (copia-o inteiro).',
  })
  token: string;
}
