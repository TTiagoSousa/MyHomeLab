import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AppLocationDto } from './app-location.dto';

export class CreateCoolifyAccountDto extends AppLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  /** O endereço do Coolify, ex.: https://coolify.exemplo.com ou http://192.168.1.10:8000 */
  @IsUrl({ require_tld: false, require_protocol: false })
  baseUrl: string;

  /** O token de Keys & Tokens → API tokens (ex.: "1|abc…"). */
  @IsString()
  @MinLength(10)
  @MaxLength(400)
  apiToken: string;
}
