import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Agent } from 'src/generated/prisma/client/client';
import { AgentData, AgentRepository, NewAgent } from '../agent-repository';

/** A equipa de agentes é de cada utilizador. */
@Injectable()
export class PrismaAgentRepository implements AgentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findTeam(userId: string): Promise<Agent[]> {
    return this.prisma.agent.findMany({
      where: { userId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  findById(userId: string, id: string): Promise<Agent | null> {
    return this.prisma.agent.findFirst({ where: { id, userId } });
  }

  async createTeam(userId: string, agents: NewAgent[]): Promise<void> {
    await this.prisma.agent.createMany({
      data: agents.map((agent) => ({ ...agent, userId })),
      skipDuplicates: true,
    });
  }

  create(userId: string, agent: NewAgent): Promise<Agent> {
    return this.prisma.agent.create({ data: { ...agent, userId } });
  }

  update(id: string, data: Partial<AgentData>): Promise<Agent> {
    return this.prisma.agent.update({ where: { id }, data });
  }

  async delete(agent: Agent): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.agent.updateMany({
        where: { userId: agent.userId, reportsToId: agent.id },
        data: { reportsToId: agent.reportsToId },
      }),
      this.prisma.agent.delete({ where: { id: agent.id } }),
    ]);
  }

  async findOwnerOfTool(userId: string, tool: string): Promise<string | null> {
    const owner = await this.prisma.agent.findFirst({
      where: { userId, isActive: true, tools: { has: tool } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { key: true },
    });
    return owner?.key ?? null;
  }
}
