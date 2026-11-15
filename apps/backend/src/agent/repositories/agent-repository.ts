import {
  Agent,
  AgentEffort,
  AgentModel,
} from 'src/generated/prisma/client/client';

export interface AgentData {
  name: string;
  description: string;
  prompt: string | null;
  extraPrompt: string | null;
  model: AgentModel;
  effort: AgentEffort;
  tools: string[];
  reportsToId: string | null;
  color: number;
  isActive: boolean;
}

export interface NewAgent extends AgentData {
  id?: string;
  key: string;
  template: string | null;
  position: number;
}

export interface AgentRepository {
  /** A equipa toda, pela ordem da página. */
  findTeam(userId: string): Promise<Agent[]>;
  findById(userId: string, id: string): Promise<Agent | null>;
  /** Cria a equipa inicial; se outro pedido já a criou, não duplica. */
  createTeam(userId: string, agents: NewAgent[]): Promise<void>;
  create(userId: string, agent: NewAgent): Promise<Agent>;
  update(id: string, data: Partial<AgentData>): Promise<Agent>;
  /** Apaga e passa a equipa dele para o chefe dele. */
  delete(agent: Agent): Promise<void>;
  /** A chave do agente ativo que tem esta ferramenta, para a atividade automática. */
  findOwnerOfTool(userId: string, tool: string): Promise<string | null>;
}
