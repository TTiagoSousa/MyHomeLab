import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppAccessLevel } from 'src/generated/prisma/client/client';
import { TOOL_CATALOG } from './tool-catalog';
import { AccessTarget, AccessTargetType, setsOf } from './helpers/appAccess';

const host = (url: string | null) => {
  try {
    return url ? new URL(url).host.toLowerCase() : '';
  } catch {
    return '';
  }
};

/**
 * O que cada agente pode fazer em cada app ligada e servidor (a página da app →
 * Agentes). Junta-se às permissões por área (Assistente → Definições → Permissões)
 * e às ferramentas de cada agente (Workflow).
 */
@Injectable()
export class AgentAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Os agentes e o que cada um pode nesta app: o guardado e o que as ferramentas dele deixam. */
  async list(userId: string, type: AccessTargetType, targetId: string) {
    const provider = await this.providerOf(userId, type, targetId);
    const sets = setsOf(provider);
    const [agents, rows] = await Promise.all([
      this.prisma.agent.findMany({
        where: { userId },
        select: { key: true, name: true, isActive: true, tools: true },
        orderBy: { position: 'asc' },
      }),
      this.prisma.agentAppAccess.findMany({
        where: { userId, targetType: type, targetId },
      }),
    ]);
    return agents.map((agent) => {
      const tools = TOOL_CATALOG.filter(
        (tool) => sets.includes(tool.set) && agent.tools.includes(tool.name),
      );
      return {
        agentKey: agent.key,
        name: agent.name,
        isActive: agent.isActive,
        canRead: tools.length > 0,
        canWrite: tools.some((tool) => tool.access === 'write'),
        level: rows.find((row) => row.agentKey === agent.key)?.level ?? null,
      };
    });
  }

  async set(
    userId: string,
    type: AccessTargetType,
    targetId: string,
    agentKey: string,
    level: AppAccessLevel | null,
  ) {
    await this.providerOf(userId, type, targetId);
    const agent = await this.prisma.agent.findFirst({
      where: { userId, key: agentKey },
    });
    if (!agent) throw new BadRequestException('Este agente já não existe.');
    const where = {
      userId_targetType_targetId_agentKey: {
        userId,
        targetType: type,
        targetId,
        agentKey,
      },
    };
    if (!level) {
      await this.prisma.agentAppAccess.deleteMany({
        where: { userId, targetType: type, targetId, agentKey },
      });
    } else {
      await this.prisma.agentAppAccess.upsert({
        where,
        create: { userId, targetType: type, targetId, agentKey, level },
        update: { level },
      });
    }
    return this.list(userId, type, targetId);
  }

  /** Para o guarda das ferramentas: as apps e servidores com os níveis guardados. */
  async targets(userId: string): Promise<AccessTarget[]> {
    const [accounts, servers, rows] = await Promise.all([
      this.prisma.connectedAccount.findMany({
        where: { userId },
        select: {
          id: true,
          provider: true,
          displayName: true,
          emailAddress: true,
          username: true,
          baseUrl: true,
          caldavUsername: true,
        },
      }),
      this.prisma.serverConnection.findMany({
        where: { userId },
        select: { id: true, name: true, host: true },
      }),
      this.prisma.agentAppAccess.findMany({ where: { userId } }),
    ]);
    const levels = (type: AccessTargetType, id: string) =>
      Object.fromEntries(
        rows
          .filter((row) => row.targetType === type && row.targetId === id)
          .map((row) => [row.agentKey, row.level]),
      );
    return [
      ...accounts.map((account) => ({
        type: 'APP' as const,
        id: account.id,
        provider: account.provider,
        names: [
          account.displayName,
          account.emailAddress,
          account.username,
          account.caldavUsername,
          host(account.baseUrl),
          account.id,
        ]
          .filter((name): name is string => Boolean(name))
          .map((name) => name.toLowerCase()),
        levels: levels('APP', account.id),
      })),
      ...servers.map((server) => ({
        type: 'SERVER' as const,
        id: server.id,
        provider: 'PROXMOX' as const,
        names: [server.name, server.host, server.id].map((name) =>
          name.toLowerCase(),
        ),
        levels: levels('SERVER', server.id),
      })),
    ];
  }

  private async providerOf(
    userId: string,
    type: AccessTargetType,
    targetId: string,
  ) {
    if (type === 'SERVER') {
      const server = await this.prisma.serverConnection.findFirst({
        where: { id: targetId, userId },
      });
      if (!server) throw new NotFoundException('Este servidor já não existe.');
      return 'PROXMOX' as const;
    }
    const account = await this.prisma.connectedAccount.findFirst({
      where: { id: targetId, userId },
    });
    if (!account) throw new NotFoundException('Esta app já não existe.');
    return account.provider;
  }
}
