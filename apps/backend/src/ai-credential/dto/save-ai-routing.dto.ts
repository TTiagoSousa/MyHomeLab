import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const PROVIDERS = ['claude-code', 'claude-api'] as const;
type Provider = (typeof PROVIDERS)[number];

/** O fornecedor de cada tipo de trabalho; o que não vem fica como estava. */
class AiRoutesDto {
  @IsOptional() @IsIn(PROVIDERS) chat?: Provider;
  @IsOptional() @IsIn(PROVIDERS) study?: Provider;
  @IsOptional() @IsIn(PROVIDERS) install?: Provider;
  @IsOptional() @IsIn(PROVIDERS) schedule?: Provider;
  @IsOptional() @IsIn(PROVIDERS) delegation?: Provider;
}

export class SaveAiRoutingDto {
  @IsOptional()
  @IsBoolean()
  mixed?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => AiRoutesDto)
  routes?: AiRoutesDto;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  maxClaudeCodeRuns?: number;
}
