import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';
import { AppLocationDto } from './app-location.dto';

export class CreateNextcloudAccountDto extends AppLocationDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsUrl({ require_tld: false })
  caldavUrl: string;

  @IsString()
  @MinLength(1)
  caldavUsername: string;

  @IsString()
  @MinLength(1)
  caldavPassword: string;
}
