import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AppLocationDto } from './app-location.dto';

export class CreateVaultwardenAccountDto extends AppLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  /** O endereço do Vaultwarden, ex.: https://cofre.exemplo.com */
  @IsUrl({ require_tld: false })
  baseUrl: string;

  /** O ADMIN_TOKEN em texto (o que se escreve em /admin), não o hash argon2. */
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  adminToken: string;
}
