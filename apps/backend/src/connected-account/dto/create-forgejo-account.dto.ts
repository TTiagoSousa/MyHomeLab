import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AppLocationDto } from './app-location.dto';

export class CreateForgejoAccountDto extends AppLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  /** O endereço da instância, ex.: https://git.exemplo.com */
  @IsUrl({ require_tld: false })
  baseUrl: string;

  /** Um token de acesso criado em Definições → Aplicações, no Forgejo. */
  @IsString()
  @MinLength(1)
  token: string;
}
