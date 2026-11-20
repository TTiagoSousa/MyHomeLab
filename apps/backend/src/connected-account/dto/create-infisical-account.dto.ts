import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AppLocationDto } from './app-location.dto';

export class CreateInfisicalAccountDto extends AppLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  /** O endereço do Infisical, ex.: https://segredos.exemplo.com */
  @IsUrl({ require_tld: false })
  baseUrl: string;

  /** O Client ID da Machine Identity (Universal Auth). */
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  clientId: string;

  /** O Client Secret da mesma identidade (só aparece uma vez no Infisical). */
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  clientSecret: string;
}
