import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { RunFrequency } from 'src/generated/prisma/client/client';

export class ConnectOpenGymDto {
  /** O endereço da instância do openGym (https://opengym.exemplo.com). */
  @IsString()
  @MaxLength(300)
  baseUrl!: string;

  /** O código de emparelhamento gerado no openGym (8 letras, válido 5 minutos). */
  @IsString()
  @Matches(/^\s*[A-Za-z0-9]{8}\s*$/, {
    message: 'O código tem 8 letras e números.',
  })
  code!: string;
}

/** Usar a app openGym já ligada em Apps ligadas. */
export class UseOpenGymAppDto {
  @IsUUID()
  accountId!: string;
}

export class UpdateOpenGymDto {
  /** Liga ou desliga a sincronização automática. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(RunFrequency)
  runFrequency?: RunFrequency;
}
