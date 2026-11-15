import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * O cliente máquina do MCP do TREK (Definições → Integrações → MCP → OAuth 2.1 Clients
 * → New Client → Machine client): o id e o segredo. Os dois vazios tiram-no.
 */
export class SetTrekMcpDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  clientSecret?: string;
}
