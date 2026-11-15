import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ServerSshDto {
  /** O utilizador com que se entra por SSH (por omissão root). */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Matches(/^[a-z_][a-z0-9_-]*$/i)
  user?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;
}
