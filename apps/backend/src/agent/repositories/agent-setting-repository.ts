import { AgentSetting } from 'src/generated/prisma/client/client';

export interface AgentSettingRepository {
  /** Legado: as instruções extra dos agentes antigos, para passarem para a equipa. */
  findAll(userId: string): Promise<AgentSetting[]>;
  findDeniedPermissions(userId: string): Promise<string[]>;
  saveDeniedPermissions(userId: string, denied: string[]): Promise<string[]>;
}
