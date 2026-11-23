import { IsString, MaxLength, MinLength } from 'class-validator';

export class SetWeatherDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city: string;
}
