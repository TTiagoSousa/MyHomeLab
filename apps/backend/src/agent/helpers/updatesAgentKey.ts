import { PrismaService } from 'src/prisma/prisma.service';

/**
 * O agente que trata das atualizações (o que tem update_save_study): na equipa
 * de origem é o `infra`, mas cada um dá-lhe o nome que quiser (ex.:
 * "engenheiro-de-servidores"). Sem nenhum, `infra`.
 */
export async function updatesAgentKey(
  prisma: PrismaService,
  userId: string,
): Promise<string> {
  const agent = await prisma.agent.findFirst({
    where: { userId, isActive: true, tools: { has: 'update_save_study' } },
    orderBy: { position: 'asc' },
    select: { key: true },
  });
  return agent?.key ?? 'infra';
}
