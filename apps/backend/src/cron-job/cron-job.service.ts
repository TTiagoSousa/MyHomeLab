import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { findConnectedAccount } from 'src/connected-account/helpers/findConnectedAccount';
import { toHttpError } from 'src/integrations/app-integration.error';
import {
  CronJob,
  Prisma,
  ProjectKind,
} from 'src/generated/prisma/client/client';
import {
  partOfJob,
  updateCronOptions,
} from 'src/app-update/helpers/updateCronOptions';
import { DiskAlertService } from 'src/disk-alert/disk-alert.service';
import { ConnectedAccountService } from 'src/connected-account/connected-account.service';
import {
  CronJobContext,
  CronJobDefinition,
  CronJobTarget,
  cronJob,
  cronJobsFor,
  intervalsOf,
} from './cron-job.registry';
import { runCronJob } from './helpers/runCronJob';

export interface CronJobView {
  key: string;
  intervalMinutes: number;
  intervals: readonly number[];
  options: unknown;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  lastOk: boolean | null;
  lastCount: number | null;
  lastDetail: unknown;
  lastError: string | null;
  running: boolean;
}

/** De quem é a tarefa: uma app ligada ou um servidor. */
export type CronScope =
  { kind: 'account'; id: string } | { kind: 'server'; id: string };

const where = (scope: CronScope) =>
  scope.kind === 'account'
    ? { accountId: scope.id }
    : { serverConnectionId: scope.id };

const uniqueOf = (scope: CronScope, key: string) =>
  scope.kind === 'account'
    ? { accountId_key: { accountId: scope.id, key } }
    : { serverConnectionId_key: { serverConnectionId: scope.id, key } };

const idOf = (row: CronJob) =>
  `${row.accountId ?? row.serverConnectionId}:${row.key}`;

/**
 * Os cron jobs das apps e dos servidores: as tarefas fixas do registo (cron-job.registry.ts)
 * de cada conta ou servidor, com o intervalo e as opções escolhidas. O scheduler corre as
 * que chegaram à hora, uma de cada vez.
 */
@Injectable()
export class CronJobService {
  private readonly logger = new Logger(CronJobService.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: PrismaConnectedAccountRepository,
    private readonly diskAlerts: DiskAlertService,
    private readonly connected: ConnectedAccountService,
  ) {}

  private view(definition: CronJobDefinition, row?: CronJob): CronJobView {
    return {
      key: definition.key,
      intervalMinutes: row?.intervalMinutes ?? 0,
      intervals: intervalsOf(definition),
      options: definition.options
        ? definition.options(row?.options, false)
        : null,
      nextRunAt: row?.nextRunAt ?? null,
      lastRunAt: row?.lastRunAt ?? null,
      lastOk: row?.lastOk ?? null,
      lastCount: row?.lastCount ?? null,
      lastDetail: row?.lastDetail ?? null,
      lastError: row?.lastError ?? null,
      running: row ? this.running.has(idOf(row)) : false,
    };
  }

  /** O alvo do registo para este âmbito, depois de confirmar que é do utilizador. */
  private async targetOf(
    userId: string,
    scope: CronScope,
  ): Promise<CronJobTarget> {
    if (scope.kind === 'account') {
      const account = await findConnectedAccount(
        scope.id,
        userId,
        this.accounts,
      );
      return { kind: 'account', provider: account.provider };
    }
    const server = await this.prisma.serverConnection.findFirst({
      where: { id: scope.id, userId },
      select: { id: true },
    });
    if (!server) throw new NotFoundException('Esse servidor já não existe.');
    return { kind: 'server' };
  }

  async list(userId: string, scope: CronScope): Promise<CronJobView[]> {
    const target = await this.targetOf(userId, scope);
    const rows = await this.prisma.cronJob.findMany({ where: where(scope) });
    return cronJobsFor(target).map((job) =>
      this.view(
        job,
        rows.find((row) => row.key === job.key),
      ),
    );
  }

  private async rowFor(userId: string, scope: CronScope, key: string) {
    const target = await this.targetOf(userId, scope);
    const definition = cronJob(key);
    if (!definition || !cronJobsFor(target).includes(definition)) {
      throw new BadRequestException('Aqui não há essa tarefa.');
    }
    const row = await this.prisma.cronJob.upsert({
      where: uniqueOf(scope, key),
      create: { userId, key, ...where(scope) },
      update: {},
    });
    return { definition, row };
  }

  private context(row: CronJob): Omit<CronJobContext, 'options'> {
    return {
      userId: row.userId,
      accountId: row.accountId,
      serverConnectionId: row.serverConnectionId,
      accounts: this.accounts,
      diskAlerts: this.diskAlerts,
      connected: this.connected,
    };
  }

  /** Muda o intervalo (e as opções); ao ligar, a primeira vez é já no próximo minuto. */
  async save(
    userId: string,
    scope: CronScope,
    key: string,
    input: { intervalMinutes: number; options?: Record<string, unknown> },
  ): Promise<CronJobView> {
    const { definition, row } = await this.rowFor(userId, scope, key);
    if (!intervalsOf(definition).includes(input.intervalMinutes)) {
      throw new BadRequestException('Esse intervalo não existe nesta tarefa.');
    }
    const enabling = input.intervalMinutes > 0;
    const options = definition.options
      ? definition.options(input.options ?? row.options, enabling)
      : null;
    if (!row.intervalMinutes && enabling && definition.onEnable) {
      await definition
        .onEnable({ ...this.context(row), options })
        .catch((error: unknown) => {
          throw toHttpError(error);
        });
    }
    const saved = await this.prisma.cronJob.update({
      where: { id: row.id },
      data: {
        intervalMinutes: input.intervalMinutes,
        options:
          options === null ? Prisma.DbNull : (options as Prisma.InputJsonValue),
        nextRunAt: enabling ? new Date() : null,
      },
    });
    return this.view(definition, saved);
  }

  /**
   * Os cron jobs das atualizações de todas as apps dele e os projetos de atualizações
   * que se podem escolher (o assistente liga-os quando ele pede).
   */
  async updateJobs(userId: string) {
    const [accounts, projects, rows] = await Promise.all([
      this.prisma.connectedAccount.findMany({
        where: { userId, disconnectedAt: null },
        select: { id: true, provider: true, displayName: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.project.findMany({
        where: { userId, kind: ProjectKind.UPDATES },
        select: { id: true, name: true },
        orderBy: { position: 'asc' },
      }),
      this.prisma.cronJob.findMany({
        where: { userId, key: { startsWith: 'updates.' } },
      }),
    ]);
    const jobs = accounts.flatMap((account) =>
      cronJobsFor({ kind: 'account', provider: account.provider })
        .filter((job) => partOfJob(job.key))
        .map((job) => {
          const row = rows.find(
            (item) => item.accountId === account.id && item.key === job.key,
          );
          return {
            accountId: account.id,
            app: account.displayName || account.provider,
            key: job.key,
            part: partOfJob(job.key)!,
            intervalMinutes: row?.intervalMinutes ?? 0,
            intervals: intervalsOf(job),
            options: updateCronOptions(row?.options, false),
          };
        }),
    );
    return { jobs, projects };
  }

  /** Corre já (fora do intervalo); a próxima vez passa a contar a partir de agora. */
  async runNow(
    userId: string,
    scope: CronScope,
    key: string,
  ): Promise<CronJobView> {
    const { definition, row } = await this.rowFor(userId, scope, key);
    if (definition.options) definition.options(row.options, true);
    const done = await this.runGuarded(row);
    return this.view(definition, done ?? row);
  }

  private async runGuarded(row: CronJob): Promise<CronJob | null> {
    const id = idOf(row);
    if (this.running.has(id)) return null;
    this.running.add(id);
    try {
      return await runCronJob(row, this.context(row), this.prisma);
    } finally {
      this.running.delete(id);
    }
  }

  /** As que chegaram à hora (contas ligadas e ativas, ou servidores), uma de cada vez. */
  async runDue(): Promise<void> {
    const due = await this.prisma.cronJob.findMany({
      where: {
        intervalMinutes: { gt: 0 },
        nextRunAt: { lte: new Date() },
        OR: [
          { account: { disconnectedAt: null, isActive: true } },
          { serverConnectionId: { not: null } },
        ],
      },
      orderBy: { nextRunAt: 'asc' },
    });
    for (const row of due) {
      const done = await this.runGuarded(row);
      if (done && !done.lastOk) {
        this.logger.warn(
          `Cron job ${row.key} (${idOf(row)}): ${done.lastError}`,
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
