import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AppLocationDto } from './app-location.dto';

export class CreateTplinkRouterAccountDto extends AppLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  /** O endereço da página de gestão, ex.: http://tplinkwifi.net ou o IP do router. */
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  baseUrl: string;

  /** O utilizador da página de gestão (quase sempre "admin"). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  username?: string;

  /** A palavra-passe local do router (a do TP-Link ID não serve). */
  @IsString()
  @MinLength(1)
  @MaxLength(125)
  password: string;
}
