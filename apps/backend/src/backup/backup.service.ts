import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RUN_FREQUENCY_INTERVAL_MS } from '@myhomelab/shared';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  BackupDestination,
  BackupDestinationKind,
  BackupRunStatus,
  ConnectionProvider,
  NotificationKind,
  Prisma,
} from 'src/generated/prisma/client/client';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { NotificationService } from 'src/notification/notification.service';
import { toHttpError } from 'src/integrations/app-integration.error';
import { decryptToken, encryptToken } from 'src/utils/crypto/token-cipher';
import {
  CreateBackupDestinationDto,
  CreateBackupJobDto,
  UpdateBackupDestinationDto,
  UpdateBackupJobDto,
} from './dto/backup.dto';
import { Readable } from 'stream';
import { backupFileName } from './helpers/backupFileName';
import { backupsToDelete } from './helpers/backupsToDelete';
import { createNextcloudFiles, joinPath } from './helpers/nextcloudFiles';
import { createLocalFiles } from './helpers/localFiles';
import { InstanceBackupService } from './instance-backup.service';

/** O backup do próprio MyHomeLab (um BackupJob sem app ligada). */
const INSTANCE_SOURCE = {
  prefix: 'myhomelab',
  extension: 'zip',
  name: 'MyHomeLab',
} as const;

/** Quantas execuções de cada backup ficam no histórico. */
const RUNS_KEPT = 30;

const DESTINATION_VIEW = {
  id: true,
  kind: true,
  name: true,
  accountId: true,
  account: {
    select: {
      displayName: true,
      caldavUsername: true,
      caldavUrl: true,
      disconnectedAt: true,
    },
  },
  url: true,
  username: true,
  folder: true,
  lastCheckedAt: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { jobs: { where: { accountId: null } } } },
} as const;

const JOB_INCLUDE = {
  account: {
    select: {
      id: true,
      provider: true,
      displayName: true,
      username: true,
      baseUrl: true,
    },
  },
  destination: { select: { id: true, name: true, kind: true, folder: true } },
  runs: { orderBy: { startedAt: 'desc' }, take: 10 },
} as const;

export interface BackupRunResult {
  ok: boolean;
  fileName: string | null;
  sizeBytes: number | null;
  deleted: number;
  missing: string[];
  error: string | null;
}

const errorMessage = (error: unknown) => {
  const http = toHttpError(error);
  if (http instanceof HttpException) {
    const body = http.getResponse();
    if (typeof body === 'object' && body && 'message' in body) {
      return String(body.message);
    }
  }
  return error instanceof Error ? error.message : String(error);
};

/** O endereço do Nextcloud a partir do CalDAV da conta: tira o /remote.php/dav… */
const nextcloudBase = (caldavUrl: string) =>
  caldavUrl.replace(/\/remote\.php\/.*$/i, '').replace(/\/+$/, '');

/**
 * Os backups: destinos (o Nextcloud, por WebDAV — a conta de Apps ligadas ou
 * credenciais próprias) e backups automáticos das apps ligadas. Cada backup lê
 * a app pela API, grava um ficheiro na pasta escolhida e aplica a retenção. Um
 * backup que falha abre um alerta, que fecha no próximo que correr bem.
 */
@Injectable()
export class BackupService {
  /** Os trabalhos a correr agora: um backup lento (ex.: o do Home Assistant) não pode arrancar duas vezes. */
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly accounts: PrismaConnectedAccountRepository,
    private readonly instance: InstanceBackupService,
  ) {}

  // ── Destinos ─────────────────────────────────────────────────────────────

  async destinations(userId: string) {
    const destinations = await this.prisma.backupDestination.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: DESTINATION_VIEW,
    });
    return destinations.map(({ _count, account, ...destination }) => ({
      ...destination,
      url: account?.caldavUrl
        ? nextcloudBase(account.caldavUrl)
        : destination.url,
      username: account?.caldavUsername ?? destination.username,
      account: account
        ? {
            name: account.displayName ?? account.caldavUsername,
            disconnected: Boolean(account.disconnectedAt),
          }
        : null,
      jobCount: _count.jobs,
    }));
  }

  /**
   * Grava só depois de confirmar que entra no Nextcloud e consegue criar a pasta.
   * Com uma conta de Apps ligadas não se guardam credenciais: usam-se as dela.
   */
  async createDestination(userId: string, dto: CreateBackupDestinationDto) {
    const folder = joinPath(dto.folder ?? 'backups');
    if (dto.kind === BackupDestinationKind.LOCAL) {
      await this.assertNextcloud(createLocalFiles(), folder);
      return this.prisma.backupDestination.create({
        data: {
          userId,
          kind: BackupDestinationKind.LOCAL,
          name: dto.name.trim(),
          folder,
          lastCheckedAt: new Date(),
        },
        select: { id: true },
      });
    }
    const credentials = await this.destinationCredentials(userId, dto, null);
    await this.assertNextcloud(credentials.files, folder);
    return this.prisma.backupDestination.create({
      data: {
        userId,
        name: dto.name.trim(),
        ...credentials.data,
        folder,
        lastCheckedAt: new Date(),
      },
      select: { id: true },
    });
  }

  async updateDestination(
    userId: string,
    id: string,
    dto: UpdateBackupDestinationDto,
  ) {
    const current = await this.findDestination(userId, id);
    const folder = joinPath(dto.folder ?? current.folder);
    if (current.kind === BackupDestinationKind.LOCAL) {
      await this.assertNextcloud(createLocalFiles(), folder);
      await this.prisma.backupDestination.update({
        where: { id },
        data: {
          name: dto.name?.trim() ?? current.name,
          folder,
          lastCheckedAt: new Date(),
          lastError: null,
        },
      });
      return { id };
    }
    const credentials = await this.destinationCredentials(userId, dto, current);
    await this.assertNextcloud(credentials.files, folder);

    await this.prisma.backupDestination.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? current.name,
        ...credentials.data,
        folder,
        lastCheckedAt: new Date(),
        lastError: null,
      },
    });
    return { id };
  }

  /**
   * Conta de Apps ligadas (accountId) ou credenciais próprias. Na edição, o que não
   * vem mantém-se, e a password em branco mantém a guardada.
   */
  private async destinationCredentials(
    userId: string,
    dto: UpdateBackupDestinationDto,
    current: BackupDestination | null,
  ) {
    const accountId =
      dto.accountId !== undefined
        ? dto.accountId
        : (current?.accountId ?? null);
    if (accountId) {
      const account = await this.nextcloudAccount(userId, accountId);
      return {
        files: createNextcloudFiles(
          nextcloudBase(account.caldavUrl!),
          account.caldavUsername!,
          account.caldavPassword!,
        ),
        data: { accountId, url: null, username: null, password: null },
      };
    }

    const url = (dto.url ?? current?.url ?? '').trim().replace(/\/+$/, '');
    const username = (dto.username ?? current?.username ?? '').trim();
    const password =
      dto.password?.trim() ||
      (current?.password ? decryptToken(current.password) : '');
    if (!url || !username || !password) {
      throw new BadRequestException(
        'Escolhe uma conta Nextcloud ligada, ou preenche o endereço, o utilizador e a password de aplicação.',
      );
    }
    return {
      files: createNextcloudFiles(url, username, password),
      data: {
        accountId: null,
        url,
        username,
        password:
          dto.password || !current?.password
            ? encryptToken(password)
            : current.password,
      },
    };
  }

  private async nextcloudAccount(userId: string, accountId: string) {
    const account = await this.accounts.findById(accountId);
    if (
      !account ||
      account.userId !== userId ||
      account.provider !== ConnectionProvider.NEXTCLOUD ||
      account.disconnectedAt
    ) {
      throw new NotFoundException('Conta Nextcloud não encontrada');
    }
    if (
      !account.caldavUrl ||
      !account.caldavUsername ||
      !account.caldavPassword
    ) {
      throw new BadRequestException(
        'Esta conta Nextcloud não tem credenciais. Liga-a outra vez em Apps ligadas.',
      );
    }
    return account;
  }

  async removeDestination(userId: string, id: string) {
    await this.findDestination(userId, id);
    const jobs = await this.prisma.backupJob.count({
      where: { destinationId: id, accountId: null },
    });
    if (jobs) {
      throw new ConflictException({
        code: 'DESTINATION_IN_USE',
        message:
          'Este destino ainda é usado pelos backups do MyHomeLab. Remove-os ou muda-lhes o destino primeiro.',
        services: ['MyHomeLab'],
      });
    }
    // Os backups antigos das apps (parados desde que saíram) vão com o destino; os ficheiros ficam lá.
    await this.prisma.$transaction([
      this.prisma.backupJob.deleteMany({ where: { destinationId: id } }),
      this.prisma.backupDestination.delete({ where: { id } }),
    ]);
  }

  /** Entra no Nextcloud e diz como quem e quanto espaço há. */
  async checkDestination(userId: string, id: string) {
    const destination = await this.findDestination(userId, id);
    try {
      const account = await (await this.filesFor(destination)).account();
      await this.prisma.backupDestination.update({
        where: { id },
        data: { lastCheckedAt: new Date(), lastError: null },
      });
      return {
        ok: true,
        user: account.displayName ?? account.userId,
        freeBytes: account.freeBytes,
      };
    } catch (error) {
      const message = errorMessage(error);
      await this.prisma.backupDestination.update({
        where: { id },
        data: { lastCheckedAt: new Date(), lastError: message },
      });
      return { ok: false, error: message };
    }
  }

  // ── Backups ──────────────────────────────────────────────────────────────

  /** Os backups do próprio MyHomeLab. Os das apps ligadas saíram: as linhas antigas ficam paradas. */
  async jobs(userId: string) {
    return this.prisma.backupJob.findMany({
      where: { userId, accountId: null },
      orderBy: { createdAt: 'asc' },
      include: JOB_INCLUDE,
    });
  }

  /** Um backup do próprio MyHomeLab (só administradores). As apps ligadas já não têm backups aqui. */
  async createJob(userId: string, dto: CreateBackupJobDto, isAdmin = false) {
    if (dto.accountId) {
      throw new BadRequestException(
        'As apps ligadas já não têm backups no MyHomeLab: usa o backup da própria app ou o do CT no Proxmox.',
      );
    }
    if (!isAdmin) {
      throw new BadRequestException(
        'Só um administrador faz backups do MyHomeLab.',
      );
    }
    await this.findDestination(userId, dto.destinationId);

    return this.prisma.backupJob.create({
      data: {
        userId,
        accountId: null,
        destinationId: dto.destinationId,
        folder: joinPath(dto.folder),
        runFrequency: dto.runFrequency,
        retention: dto.retention,
        keepCount: dto.keepCount,
        isActive: dto.isActive,
        options: (dto.options ?? undefined) as Prisma.InputJsonValue,
      },
      include: JOB_INCLUDE,
    });
  }

  async updateJob(userId: string, id: string, dto: UpdateBackupJobDto) {
    await this.findJob(userId, id);
    if (dto.destinationId)
      await this.findDestination(userId, dto.destinationId);
    return this.prisma.backupJob.update({
      where: { id },
      data: {
        destinationId: dto.destinationId,
        folder: dto.folder != null ? joinPath(dto.folder) : undefined,
        runFrequency: dto.runFrequency,
        retention: dto.retention,
        keepCount: dto.keepCount,
        isActive: dto.isActive,
        options: (dto.options ?? undefined) as Prisma.InputJsonValue,
      },
      include: JOB_INCLUDE,
    });
  }

  /** Apaga o backup automático; os ficheiros já gravados ficam no destino. */
  async removeJob(userId: string, id: string) {
    await this.findJob(userId, id);
    await this.prisma.backupJob.delete({ where: { id } });
    await this.notifications.resolveUserSubject(
      userId,
      `backup:${id}`,
      NotificationKind.BACKUP_FAILED,
    );
  }

  async runNow(userId: string, id: string) {
    await this.findJob(userId, id);
    if (this.running.has(id)) {
      throw new ConflictException(
        'Este backup já está a correr. Espera que acabe.',
      );
    }
    return this.run(id, true);
  }

  async dueJobs() {
    const jobs = await this.prisma.backupJob.findMany({
      where: { isActive: true, accountId: null },
      select: { id: true, runFrequency: true, lastRunAt: true },
    });
    return jobs.filter(
      (job) =>
        !this.running.has(job.id) &&
        (!job.lastRunAt ||
          Date.now() - job.lastRunAt.getTime() >=
            RUN_FREQUENCY_INTERVAL_MS[job.runFrequency]),
    );
  }

  /**
   * Faz o backup do MyHomeLab: grava `<pasta do destino>/<pasta>/myhomelab-<data>.zip`
   * e apaga os antigos a mais. Guarda a execução no histórico e abre ou fecha o
   * alerta. Nunca lança — o resultado diz se correu bem.
   */
  async run(id: string, manual = false): Promise<BackupRunResult> {
    this.running.add(id);
    try {
      return await this.runJob(id, manual);
    } finally {
      this.running.delete(id);
    }
  }

  private async runJob(id: string, manual: boolean): Promise<BackupRunResult> {
    const job = await this.prisma.backupJob.findUniqueOrThrow({
      where: { id },
      include: { destination: true },
    });
    const startedAt = new Date();
    const { prefix, extension } = INSTANCE_SOURCE;
    const folder = joinPath(job.destination.folder, job.folder);
    let result: BackupRunResult;

    try {
      if (job.accountId) {
        throw new Error(
          'As apps ligadas já não têm backups no MyHomeLab: usa o backup da própria app ou o do CT no Proxmox.',
        );
      }
      const files = await this.filesFor(job.destination);
      const { userId: davUser } = await files.account();
      const fileName = backupFileName(prefix, startedAt, extension);
      // A pasta primeiro: se não existir (ou tiver sido apagada), é criada.
      await files.ensureFolder(davUser, folder);

      const backup = await this.instance.create();
      try {
        await files.upload(
          davUser,
          joinPath(folder, fileName),
          backup.content,
          backup.sizeBytes,
        );
      } finally {
        if (backup.content instanceof Readable) backup.content.destroy();
        await backup.cleanup?.().catch(() => undefined);
      }
      const { sizeBytes, missing } = backup;

      const existing = await files.list(davUser, folder);
      const toDelete = backupsToDelete(
        existing.map((file) => file.name),
        prefix,
        job.retention,
        job.keepCount,
      );
      for (const name of toDelete) {
        await files.remove(davUser, joinPath(folder, name));
      }

      result = {
        ok: true,
        fileName: joinPath(folder, fileName),
        sizeBytes,
        deleted: toDelete.length,
        missing,
        error: null,
      };
    } catch (error) {
      result = {
        ok: false,
        fileName: null,
        sizeBytes: null,
        deleted: 0,
        missing: [],
        error: errorMessage(error),
      };
    }

    await this.record(job.id, startedAt, manual, result);

    if (result.ok) {
      await this.notifications.resolveUserSubject(
        job.userId,
        `backup:${job.id}`,
        NotificationKind.BACKUP_FAILED,
      );
    } else {
      await this.notifications.openUserSubject({
        userId: job.userId,
        subject: `backup:${job.id}`,
        kind: NotificationKind.BACKUP_FAILED,
        title: `O backup de ${INSTANCE_SOURCE.name} falhou`,
        message: `Não foi possível guardar o backup em ${job.destination.name} (${folder}): ${result.error}`,
      });
    }
    return result;
  }

  private async record(
    jobId: string,
    startedAt: Date,
    manual: boolean,
    result: BackupRunResult,
  ) {
    const finishedAt = new Date();
    await this.prisma.backupRun.create({
      data: {
        jobId,
        status: result.ok ? BackupRunStatus.SUCCESS : BackupRunStatus.ERROR,
        manual,
        fileName: result.fileName,
        sizeBytes: result.sizeBytes,
        deleted: result.deleted,
        missing: result.missing,
        error: result.error,
        startedAt,
        finishedAt,
      },
    });
    await this.prisma.backupJob.update({
      where: { id: jobId },
      data: {
        lastRunAt: finishedAt,
        lastSuccessAt: result.ok ? finishedAt : undefined,
        lastError: result.error,
      },
    });

    const old = await this.prisma.backupRun.findMany({
      where: { jobId },
      orderBy: { startedAt: 'desc' },
      skip: RUNS_KEPT,
      select: { id: true },
    });
    if (old.length) {
      await this.prisma.backupRun.deleteMany({
        where: { id: { in: old.map((run) => run.id) } },
      });
    }
  }

  private async assertNextcloud(
    files: Pick<
      ReturnType<typeof createNextcloudFiles>,
      'account' | 'ensureFolder'
    >,
    folder: string,
  ) {
    try {
      const { userId } = await files.account();
      await files.ensureFolder(userId, folder);
    } catch (error) {
      throw toHttpError(error);
    }
  }

  /** As credenciais do destino: as da conta de Apps ligadas, ou as próprias. */
  private async filesFor(destination: BackupDestination) {
    if (destination.kind === BackupDestinationKind.LOCAL) {
      return createLocalFiles();
    }
    if (destination.accountId) {
      const account = await this.nextcloudAccount(
        destination.userId,
        destination.accountId,
      );
      return createNextcloudFiles(
        nextcloudBase(account.caldavUrl!),
        account.caldavUsername!,
        account.caldavPassword!,
      );
    }
    if (!destination.url || !destination.username || !destination.password) {
      throw new BadRequestException(
        'Este destino ficou sem conta Nextcloud. Edita-o e escolhe outra conta ou põe credenciais.',
      );
    }
    return createNextcloudFiles(
      destination.url,
      destination.username,
      decryptToken(destination.password),
    );
  }

  private async findDestination(userId: string, id: string) {
    const destination = await this.prisma.backupDestination.findFirst({
      where: { id, userId },
    });
    if (!destination) throw new NotFoundException('Destino não encontrado');
    return destination;
  }

  private async findJob(userId: string, id: string) {
    const job = await this.prisma.backupJob.findFirst({
      where: { id, userId },
    });
    if (!job) throw new NotFoundException('Backup não encontrado');
    return job;
  }
}
