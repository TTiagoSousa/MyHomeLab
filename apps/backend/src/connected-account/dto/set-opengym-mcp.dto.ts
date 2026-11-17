import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * O token de API do MCP do openGym ("ogt_…", Definições → Integrações → Tokens de API).
 * Vazio tira-o.
 */
export class SetOpenGymMcpDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  token?: string;
}
