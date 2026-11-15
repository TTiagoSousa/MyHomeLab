import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AgentSettingRepository } from '../agent-setting-repository';
import { AgentSetting } from 'src/generated/prisma/client/client';

/** As permissões do assistente e, por legado, as instruções extra dos agentes antigos. */
@Injectable()
export class PrismaAgentSettingRepository implements AgentSettingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<AgentSetting[]> {
    return this.prisma.agentSetting.findMany({ where: { userId } });
  }

  async findDeniedPermissions(userId: string): Promise<string[]> {
    const setting = await this.prisma.assistantPermissionSetting.findUnique({
      where: { userId },
    });
    return setting?.denied ?? [];
  }

  async saveDeniedPermissions(
    userId: string,
    denied: string[],
  ): Promise<string[]> {
    const setting = await this.prisma.assistantPermissionSetting.upsert({
      where: { userId },
      create: { userId, denied },
      update: { denied },
    });
    return setting.denied;
  }
}
