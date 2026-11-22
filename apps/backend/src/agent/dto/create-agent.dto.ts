import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AgentEffort, AgentModel } from 'src/generated/prisma/client/client';

export class CreateAgentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  /** O que faz, numa frase: é o que o chefe lê para decidir quando o chamar. */
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description!: string;

  @IsString()
  @MaxLength(20000)
  prompt!: string;

  /**
   * A chave de um dos agentes do site (ex.: "infra"): fica com as instruções do site
   * (prompt vazio ou igual) e, se estiver livre, com a chave dele — as ligações dos
   * documentos iniciais ("Regras gerais do servidor" → infra) apontam para ela.
   */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  template?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  extraPrompt?: string | null;

  @IsEnum(AgentModel)
  model!: AgentModel;

  @IsEnum(AgentEffort)
  effort!: AgentEffort;

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  tools!: string[];

  @IsOptional()
  @IsUUID()
  reportsToId?: string | null;

  @IsInt()
  @Min(1)
  @Max(8)
  color!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
