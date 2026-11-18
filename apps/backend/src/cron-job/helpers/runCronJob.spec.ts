import { CronJob } from 'src/generated/prisma/client/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CRON_JOBS } from '../cron-job.registry';
import { runCronJob } from './runCronJob';

const row = (key: string): CronJob =>
  ({
    id: 'job-1',
    userId: 'user-1',
    accountId: 'acc-1',
    key,
    intervalMinutes: 60,
  }) as CronJob;

const prismaMock = () => {
  const update = jest.fn(({ data }: { data: Partial<CronJob> }) =>
    Promise.resolve({ ...row('x'), ...data }),
  );
  return {
    update,
    prisma: { cronJob: { update } } as unknown as PrismaService,
  };
};

const context = { accountId: 'acc-1', userId: 'user-1', accounts: {} as never };

describe('runCronJob', () => {
  const job = CRON_JOBS[0];
  const original = job.run;
  afterEach(() => (job.run = original));

  it('grava o número devolvido e a próxima vez daqui a um intervalo', async () => {
    job.run = () => Promise.resolve({ count: 3 });
    const { prisma } = prismaMock();
    const saved = await runCronJob(row(job.key), context, prisma);
    expect(saved.lastOk).toBe(true);
    expect(saved.lastCount).toBe(3);
    expect(saved.lastError).toBeNull();
    expect(saved.nextRunAt!.getTime() - saved.lastRunAt!.getTime()).toBe(
      60 * 60_000,
    );
  });

  it('grava o erro e continua a marcar a próxima vez', async () => {
    job.run = () => Promise.reject(new Error('AdGuard em baixo'));
    const { prisma } = prismaMock();
    const saved = await runCronJob(row(job.key), context, prisma);
    expect(saved.lastOk).toBe(false);
    expect(saved.lastError).toBe('AdGuard em baixo');
    expect(saved.nextRunAt).not.toBeNull();
  });

  it('uma tarefa que saiu do registo fica com o aviso', async () => {
    const { prisma } = prismaMock();
    const saved = await runCronJob(row('apagada.tarefa'), context, prisma);
    expect(saved.lastOk).toBe(false);
    expect(saved.lastError).toBe('Esta tarefa já não existe.');
  });
});
