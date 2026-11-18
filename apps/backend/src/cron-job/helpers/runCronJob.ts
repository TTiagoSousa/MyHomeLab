import { PrismaService } from 'src/prisma/prisma.service';
import { CronJob } from 'src/generated/prisma/client/client';
import { CronJobContext, cronJob } from '../cron-job.registry';
import { nextRunAt } from './nextRunAt';

const errorText = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, 1000);

/**
 * Corre uma tarefa e grava o resultado: a hora, se correu bem, o número que ela devolve
 * ou o erro, e a próxima vez (a contar de agora, mesmo quando falha).
 */
export async function runCronJob(
  row: CronJob,
  context: CronJobContext,
  prisma: PrismaService,
): Promise<CronJob> {
  const definition = cronJob(row.key);
  const startedAt = new Date();
  const outcome = definition
    ? await definition
        .run(context)
        .then((result) => ({
          ok: true,
          count: result.count ?? null,
          error: null,
        }))
        .catch((error: unknown) => ({
          ok: false,
          count: null,
          error: errorText(error),
        }))
    : { ok: false, count: null, error: 'Esta tarefa já não existe.' };
  return prisma.cronJob.update({
    where: { id: row.id },
    data: {
      lastRunAt: startedAt,
      lastOk: outcome.ok,
      lastCount: outcome.count,
      lastError: outcome.error,
      nextRunAt: nextRunAt(row.intervalMinutes, startedAt),
    },
  });
}
