import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DocLinkType } from 'src/generated/prisma/client/client';

/**
 * Os projetos vistos pelos documentos: quantos documentos tem cada um e em que
 * projetos trabalha um agente (os obrigatórios desses entram sempre no contexto).
 * Criar, mudar e apagar projetos é no quadro (Projetos).
 */
@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const [projects, links] = await Promise.all([
      this.prisma.project.findMany({
        where: { userId },
        orderBy: { name: 'asc' },
      }),
      this.prisma.docLink.groupBy({
        by: ['targetId'],
        where: { type: DocLinkType.PROJECT, doc: { userId } },
        _count: { _all: true },
      }),
    ]);
    const docs = new Map(
      links.map((link) => [link.targetId, link._count._all]),
    );
    return projects.map((project) => ({
      ...project,
      docCount: docs.get(project.id) ?? 0,
    }));
  }

  forAgent(userId: string, agentKey: string) {
    return this.prisma.project.findMany({
      where: { userId, agentKeys: { has: agentKey } },
      select: { id: true },
    });
  }
}
