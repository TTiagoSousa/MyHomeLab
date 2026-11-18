import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { findConnectedAccount } from 'src/connected-account/helpers/findConnectedAccount';
import { toHttpError } from 'src/integrations/app-integration.error';
import { CronJob } from 'src/generated/prisma/client/client';
import { CRON_INTERVALS, cronJob, cronJobsOf } from './cron-job.registry';
import { runCronJob } from './helpers/runCronJob';

export interface CronJobView {
  key: string;
  intervalMinutes: number;
  intervals: readonly number[];
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  lastOk: boolean | null;
  lastCount: number | null;
  lastError: string | null;
  running: boolean;
}

/**
 * Os cron jobs das apps: as tarefas fixas do registo (cron-job.registry.ts) de cada conta,
 * com o intervalo escolhido. O scheduler corre as que chegaram à hora, uma de cada vez.
 */
@Injectable()
export class CronJobService {
  private readonly logger = new Logger(CronJobService.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: PrismaConnectedAccountRepository,
  ) {}

  private view(key: string, accountId: string, row?: CronJob): CronJobView {
    return {
      key,
      intervalMinutes: row?.intervalMinutes ?? 0,
      intervals: CRON_INTERVALS,
      nextRunAt: row?.nextRunAt ?? null,
      lastRunAt: row?.lastRunAt ?? null,
      lastOk: row?.lastOk ?? null,
      lastCount: row?.lastCount ?? null,
      lastError: row?.lastError ?? null,
      running: this.running.has(`${accountId}:${key}`),
    };
  }

  async list(userId: string, accountId: string): Promise<CronJobView[]> {
    const account = await findConnectedAccount(
      accountId,
      userId,
      this.accounts,
    );
    const rows = await this.prisma.cronJob.findMany({ where: { accountId } });
    return cronJobsOf(account.provider).map((job) =>
      this.view(
        job.key,
        accountId,
        rows.find((row) => row.key === job.key),
      ),
    );
  }

  private async rowFor(userId: string, accountId: string, key: string) {
    const account = await findConnectedAccount(
      accountId,
      userId,
      this.accounts,
    );
    const definition = cronJob(key);
    if (!definition || definition.provider !== account.provider) {
      throw new BadRequestException('Esta app não tem essa tarefa.');
    }
    const row = await this.prisma.cronJob.upsert({
      where: { accountId_key: { accountId, key } },
      create: { userId, accountId, key },
      update: {},
    });
    return { definition, row };
  }

  /** Muda o intervalo; ao ligar, a primeira vez é já no próximo minuto. */
  async save(
    userId: string,
    accountId: string,
    key: string,
    intervalMinutes: number,
  ): Promise<CronJobView> {
    const { definition, row } = await this.rowFor(userId, accountId, key);
    if (!row.intervalMinutes && intervalMinutes && definition.onEnable) {
      await definition
        .onEnable({ accountId, userId, accounts: this.accounts })
        .catch((error: unknown) => {
          throw toHttpError(error);
        });
    }
    const saved = await this.prisma.cronJob.update({
      where: { id: row.id },
      data: {
        intervalMinutes,
        nextRunAt: intervalMinutes ? new Date() : null,
      },
    });
    return this.view(key, accountId, saved);
  }

  /** Corre já (fora do intervalo); a próxima vez passa a contar a partir de agora. */
  async runNow(
    userId: string,
    accountId: string,
    key: string,
  ): Promise<CronJobView> {
    const { row } = await this.rowFor(userId, accountId, key);
    const done = await this.runGuarded(row);
    return this.view(key, accountId, done ?? row);
  }

  private async runGuarded(row: CronJob): Promise<CronJob | null> {
    const id = `${row.accountId}:${row.key}`;
    if (this.running.has(id)) return null;
    this.running.add(id);
    try {
      return await runCronJob(
        row,
        {
          accountId: row.accountId,
          userId: row.userId,
          accounts: this.accounts,
        },
        this.prisma,
      );
    } finally {
      this.running.delete(id);
    }
  }

  /** As que chegaram à hora (contas ligadas e ativas), uma de cada vez. */
  async runDue(): Promise<void> {
    const due = await this.prisma.cronJob.findMany({
      where: {
        intervalMinutes: { gt: 0 },
        nextRunAt: { lte: new Date() },
        account: { disconnectedAt: null, isActive: true },
      },
      orderBy: { nextRunAt: 'asc' },
    });
    for (const row of due) {
      const done = await this.runGuarded(row);
      if (done && !done.lastOk) {
        this.logger.warn(
          `Cron job ${row.key} (${row.accountId}): ${done.lastError}`,
        );
      }
    }
  }

  /** Ao arrancar: uma tarefa ligada sem próxima vez (ex.: veio de um backup) corre já. */
  async fixMissingNextRun(): Promise<void> {
    await this.prisma.cronJob.updateMany({
      where: { intervalMinutes: { gt: 0 }, nextRunAt: null },
      data: { nextRunAt: new Date() },
    });
  }
}
