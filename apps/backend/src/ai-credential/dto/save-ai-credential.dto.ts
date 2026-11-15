import { IsString, MaxLength, MinLength } from 'class-validator';

export class SaveAiCredentialDto {
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  apiKey!: string;
}
