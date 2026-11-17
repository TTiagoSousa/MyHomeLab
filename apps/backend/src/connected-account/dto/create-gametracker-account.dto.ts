import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';
import { AppLocationDto } from './app-location.dto';

export class CreateGameTrackerAccountDto extends AppLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  /** O endereço do GamesTracker, ex.: https://gametracker.exemplo.com */
  @IsUrl({ require_tld: false })
  baseUrl: string;

  /**
   * O token pessoal de Definições → API → Novo token ("gtv_…"). De um admin, chega
   * também aos backups e à versão; só de leitura, os agentes não mudam a prateleira.
   */
  @IsString()
  @MaxLength(200)
  @Matches(/^\s*gtv_\S+\s*$/, {
    message: 'O token do GamesTracker começa por gtv_.',
  })
  token: string;
}
