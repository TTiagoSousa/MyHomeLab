import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AppLocationDto } from './app-location.dto';

export class CreateTrekAccountDto extends AppLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  /** O endereço do TREK, ex.: https://trek.exemplo.com */
  @IsUrl({ require_tld: false })
  baseUrl: string;

  /** O email de um administrador do TREK, sem MFA (o TREK não tem tokens de API). */
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;

  /** Opcional: o cliente máquina do MCP do TREK, para os agentes terem a API toda. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  mcpClientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  mcpClientSecret?: string;
}
