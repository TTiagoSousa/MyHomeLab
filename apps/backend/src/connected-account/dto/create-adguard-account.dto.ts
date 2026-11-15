import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AppLocationDto } from './app-location.dto';

export class CreateAdguardAccountDto extends AppLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  /** O endereço do painel do AdGuard Home, ex.: http://192.168.1.2 */
  @IsUrl({ require_tld: false })
  baseUrl: string;

  /** O utilizador e a password do painel (o AdGuard não tem tokens de API). */
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  username: string;

  @IsString()
  @MinLength(1)
  password: string;
}
