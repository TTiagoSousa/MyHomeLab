import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AppLocationDto } from './app-location.dto';

export class CreateClickHouseAccountDto extends AppLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  /** O endereço da interface HTTP, ex.: https://clickhouse.exemplo.com (o /play no fim sai). */
  @IsUrl({ require_tld: false })
  baseUrl: string;

  /** O utilizador do ClickHouse (ex.: default). */
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  username: string;

  /** A password desse utilizador (pode ser vazia, como no default de fábrica). */
  @IsOptional()
  @IsString()
  @MaxLength(400)
  password?: string;
}
