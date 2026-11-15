import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';
import { AppLocationDto } from './app-location.dto';

export class CreateOpenGymAccountDto extends AppLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  /** O endereço do openGym, ex.: https://opengym.exemplo.com */
  @IsUrl({ require_tld: false })
  baseUrl: string;

  /**
   * O código de 8 letras de Definições → emparelhar a app, no openGym (dura 5 minutos).
   * O MyHomeLab troca-o por um token, como a app do telemóvel.
   */
  @IsString()
  @Matches(/^\s*[A-Za-z0-9]{8}\s*$/, {
    message: 'O código do openGym tem 8 letras e números.',
  })
  code: string;
}
