import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateServerConnectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  host!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  /** `utilizador@realm!nome` — o Token ID completo que o Proxmox mostra. */
  @IsString()
  @Matches(/^[^@\s]+@[^!\s]+![^\s]+$/, {
    message:
      'O Token ID tem de ser utilizador@realm!nome, ex: root@pam!myhomelab',
  })
  tokenId!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  tokenSecret!: string;

  @IsOptional()
  @IsBoolean()
  verifyTls?: boolean;
}

/** Na edição tudo é opcional; o segredo em branco mantém o que está guardado. */
export class UpdateServerConnectionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  host?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[^@\s]+@[^!\s]+![^\s]+$/, {
    message:
      'O Token ID tem de ser utilizador@realm!nome, ex: root@pam!myhomelab',
  })
  tokenId?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  tokenSecret?: string;

  @IsOptional()
  @IsBoolean()
  verifyTls?: boolean;
}
