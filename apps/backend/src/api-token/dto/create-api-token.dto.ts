import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiTokenScope } from 'src/generated/prisma/client/client';

export class CreateApiTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsIn(Object.values(ApiTokenScope))
  scope!: ApiTokenScope;

  /** Vazio = não expira (revoga-se à mão). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}
