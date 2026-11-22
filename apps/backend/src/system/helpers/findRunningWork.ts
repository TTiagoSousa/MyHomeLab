import { PrismaService } from 'src/prisma/prisma.service';
import {
  AgentScheduleRunStatus,
  AppUpdateStatus,
} from 'src/generated/prisma/client/client';

/** Um disparo a correr há mais do que isto já não conta (o runner também o dá por perdido). */
const RUN_LIMIT_MS = 60 * 60_000;

/**
 * O que um reinício do backend cortava a meio: as instalações de apps (a lógica de voltar
 * atrás está na memória) e os disparos dos agentes. Atualizar ou repor o MyHomeLab
 * espera que acabem; devolve o que está a correr, para a mensagem.
 */
export async function findRunningWork(
  prisma: PrismaService,
): Promise<string[]> {
  const [updates, runs] = await Promise.all([
    prisma.appUpdate.findMany({
      where: {
        status: {
          in: [AppUpdateStatus.IN_PROGRESS, AppUpdateStatus.VERIFYING],
        },
      },
      select: {
        status: true,
        toVersion: true,
        component: true,
        account: { select: { displayName: true } },
        hostServer: { select: { name: true } },
      },
    }),
    prisma.agentScheduleRun.findMany({
      where: {
        status: AgentScheduleRunStatus.RUNNING,
        startedAt: { gt: new Date(Date.now() - RUN_LIMIT_MS) },
      },
      select: { schedule: { select: { title: true } } },
    }),
  ]);
  return [
    ...updates.map((update) => {
      const name =
        update.component ??
        update.account?.displayName ??
        update.hostServer?.name ??
        'uma app';
      const doing =
        update.status === AppUpdateStatus.IN_PROGRESS
          ? 'a instalar'
          : 'a verificar';
      return `${name} ${update.toVersion} (${doing})`;
    }),
    ...runs.map((run) => `o disparo "${run.schedule.title}"`),
  ];
}
