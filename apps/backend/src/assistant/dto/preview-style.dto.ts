import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PreviewStyleDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  customPrompt?: string;
}
