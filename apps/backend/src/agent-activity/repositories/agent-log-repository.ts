import { AgentLog, AgentLogKind } from 'src/generated/prisma/client/client';

export interface NewAgentLog {
  userId: string;
  agent: string;
  kind: AgentLogKind;
  text: string;
  requestedBy?: string | null;
  durationMs?: number | null;
}

export interface AgentLogRepository {
  create(entry: NewAgentLog): Promise<AgentLog>;
  /** Do mais recente para o mais antigo; `before` para ir buscar páginas mais antigas. */
  findPage(
    userId: string,
    options: { agent?: string; before?: Date; limit: number },
  ): Promise<AgentLog[]>;
  deleteOlderThan(date: Date): Promise<number>;
}
