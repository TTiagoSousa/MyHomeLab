import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ServiceHosting } from 'src/generated/prisma/client/client';

export class CreateServiceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @IsUrl({ require_tld: false })
  link: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2)
  abbreviation: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  color: string;

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  // Omitir é o mesmo que dizer SELF_HOSTED — ver o valor por omissão em createService.
  @IsOptional()
  @IsEnum(ServiceHosting)
  hosting?: ServiceHosting;
}
