import { AppUpdateStatus } from 'src/generated/prisma/client/client';
import { PrismaService } from 'src/prisma/prisma.service';

/** As corridas (update_run) de uma instalação: a primeira e mais 2 depois de corrigir. */
export const INSTALL_RUNS = 3;

/**
 * As instalações que um agente está a acompanhar agora (o pedido de instalar do
 * MyHomeLab). Só nessas uma corrida que falha fica em In progress para o agente
 * ver porquê e tentar outra vez; sem ninguém a acompanhar, fica logo em Failed.
 */
export const watchedInstalls = new Set<string>();

/** As corridas desta instalação: os pedidos de comandos desde que ela começou. */
export async function installRuns(
  prisma: PrismaService,
  update: { id: string; installStartedAt: Date | null; startedAt: Date | null },
): Promise<number> {
  const since = update.installStartedAt ?? update.startedAt;
  return prisma.serverCommand.count({
    where: {
      updateId: update.id,
      ...(since ? { createdAt: { gte: since } } : {}),
    },
  });
}

/**
 * Se uma instalação em In progress está parada à espera do agente (a última corrida
 * falhou e voltou ao snapshot) e quantas corridas já levou. null: não está parada.
 */
export async function pausedInstall(
  prisma: PrismaService,
  update: {
    id: string;
    status: AppUpdateStatus;
    commandId: string | null;
    installStartedAt: Date | null;
    startedAt: Date | null;
  },
): Promise<{ runs: number } | null> {
  if (update.status !== AppUpdateStatus.IN_PROGRESS || !update.commandId)
    return null;
  const command = await prisma.serverCommand.findUnique({
    where: { id: update.commandId },
    select: { status: true },
  });
  if (command?.status !== 'FAILED') return null;
  return { runs: await installRuns(prisma, update) };
}
