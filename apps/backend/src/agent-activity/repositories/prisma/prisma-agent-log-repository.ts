import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AgentLog } from 'src/generated/prisma/client/client';
import { AgentLogRepository, NewAgentLog } from '../agent-log-repository';

/** O registo dos agentes é de cada utilizador. */
@Injectable()
export class PrismaAgentLogRepository implements AgentLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(entry: NewAgentLog): Promise<AgentLog> {
    return this.prisma.agentLog.create({ data: entry });
  }

  findPage(
    userId: string,
    options: { agent?: string; before?: Date; limit: number },
  ): Promise<AgentLog[]> {
    return this.prisma.agentLog.findMany({
      where: {
        userId,
        ...(options.agent ? { agent: options.agent } : {}),
        ...(options.before ? { createdAt: { lt: options.before } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit,
    });
  }

  async deleteOlderThan(date: Date): Promise<number> {
    const { count } = await this.prisma.agentLog.deleteMany({
      where: { createdAt: { lt: date } },
    });
    return count;
  }
}
