import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Vazio volta ao modelo da app. */
export class SaveAiModelsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  main?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  agent?: string;
}
