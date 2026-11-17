import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';
import { AppLocationDto } from './app-location.dto';

export class CreateImmichAccountDto extends AppLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  /** O endereço do Immich, ex.: https://fotos.exemplo.com */
  @IsUrl({ require_tld: false })
  baseUrl: string;

  /**
   * A chave de Conta → Chaves de API. De um admin, com a permissão "all", chega também
   * às definições do servidor, às tarefas e aos backups.
   */
  @IsString()
  @MaxLength(200)
  @Matches(/^\s*[A-Za-z0-9_-]{20,}\s*$/, {
    message:
      'A chave de API do Immich tem só letras e números (copia-a inteira).',
  })
  apiKey: string;
}
