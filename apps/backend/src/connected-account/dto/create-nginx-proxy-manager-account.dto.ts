import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AppLocationDto } from './app-location.dto';

export class CreateNginxProxyManagerAccountDto extends AppLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  /** O endereço do painel, ex.: http://192.168.1.2:81 (http na rede local serve). */
  @IsUrl({ require_tld: false, require_protocol: false })
  baseUrl: string;

  /** O email e a password de um utilizador do painel (o NPM não tem tokens de API). */
  @IsEmail({ require_tld: false })
  @MaxLength(200)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(400)
  password: string;
}
