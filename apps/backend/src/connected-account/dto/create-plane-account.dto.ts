import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AppLocationDto } from './app-location.dto';

export class CreatePlaneAccountDto extends AppLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  /** O endereço do Plane, ex.: https://plane.exemplo.com */
  @IsUrl({ require_tld: false })
  baseUrl: string;

  /** O token pessoal de Definições do perfil → Personal Access Tokens. */
  @IsString()
  @MinLength(10)
  @MaxLength(400)
  apiKey: string;

  /** O espaço de trabalho: o slug (o que vem depois do endereço no link) ou um link do Plane. */
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  workspace: string;
}
