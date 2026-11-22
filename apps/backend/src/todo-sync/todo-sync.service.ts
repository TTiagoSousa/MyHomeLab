import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ConnectedAccount,
  ConnectionProvider,
  TodoSyncGroup,
  TodoSyncLink,
  TodoSyncScope,
} from 'src/generated/prisma/client/client';
import {
  decryptAccount,
  PrismaConnectedAccountRepository,
} from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { ensureFreshAccessToken } from 'src/connected-account/helpers/ensureFreshAccessToken';
import { googleRemote } from './google/googleRemote';
import { nextcloudTasksRemote } from './nextcloud/nextcloudTasks.client';
import { hostOf } from 'src/nextcloud/nextcloud.client';
import { TaskListNotFoundError, TaskRemote } from './remote/taskRemote';
import { syncLink } from './helpers/syncLink';
import { GroupAccount, reconcileGroup } from './helpers/reconcileGroup';
import { SaveTodoSyncGroupDto } from './dto/todo-sync.dto';

const errorText = (error: unknown) => {
  if (error instanceof TaskListNotFoundError)
    return 'A lista foi apagada lá: volta a ser criada na próxima volta.';
  return error instanceof Error ? error.message : String(error);
};

/** As contas que entram nos grupos: os emails do Google Tasks e os Nextcloud. */
const SYNC_PROVIDERS: ConnectionProvider[] = [
  ConnectionProvider.GOOGLE_TASKS,
  ConnectionProvider.NEXTCLOUD,
];

/** Como uma conta aparece: o email, ou o utilizador e o anfitrião do Nextcloud. */
const accountLabel = (
  account: Pick<
    ConnectedAccount,
    | 'provider'
    | 'emailAddress'
    | 'displayName'
    | 'caldavUsername'
    | 'baseUrl'
    | 'caldavUrl'
  >,
) => {
  if (account.provider !== ConnectionProvider.NEXTCLOUD)
    return account.emailAddress ?? account.displayName ?? 'Google Tasks';
  const url = account.baseUrl ?? account.caldavUrl;
  const host = hostOf(url);
  return (
    account.displayName ??
    ([account.caldavUsername, host].filter(Boolean).join('@') || 'Nextcloud')
  );
};

/** Os intervalos que se podem escolher, em minutos (5 min a 1 dia). */
export const SYNC_INTERVALS = [5, 15, 30, 60, 360, 720, 1440];

/**
 * A sincronização das Tarefas com o Google Tasks e o Nextcloud, por grupos: umas contas, se as
 * Tarefas do servidor entram, e o que sincroniza (tudo, ou só umas listas). Cada lista,
 * pelo nome, fica igual em todos os sítios do grupo, criada onde faltar. O interruptor geral pára ou retoma
 * tudo e corre de quanto em quanto tempo ele escolheu.
 */
@Injectable()
export class TodoSyncService {
  private readonly logger = new Logger(TodoSyncService.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: PrismaConnectedAccountRepository,
  ) {}

  async overview(userId: string) {
    const [setting, lists, groups, accounts] = await Promise.all([
      this.prisma.todoSyncSetting.findUnique({ where: { userId } }),
      this.prisma.todoList.findMany({
        where: { userId, hidden: false },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, name: true, color: true },
      }),
      this.prisma.todoSyncGroup.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        include: {
          links: {
            // As contas desligadas ficam de fora (as ligações voltam se a religar).
            where: { account: { disconnectedAt: null } },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              listId: true,
              accountId: true,
              remoteListName: true,
              lastSyncAt: true,
              lastError: true,
              _count: { select: { items: true } },
            },
          },
        },
      }),
      this.prisma.connectedAccount.findMany({
        where: {
          userId,
          provider: { in: SYNC_PROVIDERS },
          disconnectedAt: null,
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          provider: true,
          emailAddress: true,
          displayName: true,
          caldavUsername: true,
          baseUrl: true,
          caldavUrl: true,
          isActive: true,
        },
      }),
    ]);
    return {
      enabled: setting?.enabled ?? false,
      intervalMinutes: setting?.intervalMinutes ?? 15,
      lastRunAt: setting?.lastRunAt ?? null,
      running: this.running.has(userId),
      lists,
      accounts: accounts.map((account) => ({
        id: account.id,
        provider: account.provider,
        emailAddress: account.emailAddress,
        label: accountLabel(account),
        isActive: account.isActive,
      })),
      groups: groups.map(({ links, ...group }) => ({
        ...group,
        links: links.map(({ _count, ...link }) => ({
          ...link,
          tasks: _count.items,
        })),
      })),
    };
  }

  /** O interruptor geral e de quanto em quanto tempo sincroniza. */
  async saveSetting(
    userId: string,
    input: { enabled?: boolean; intervalMinutes?: number },
  ) {
    if (
      input.intervalMinutes !== undefined &&
      !SYNC_INTERVALS.includes(input.intervalMinutes)
    )
      throw new BadRequestException('Escolhe um dos intervalos da lista.');
    const before = await this.prisma.todoSyncSetting.findUnique({
      where: { userId },
    });
    await this.prisma.todoSyncSetting.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input,
    });
    if (input.enabled && !before?.enabled) this.runInBackground(userId);
    return this.overview(userId);
  }

  /** As listas de uma conta (para escolher em "Só estas listas"). */
  async remoteLists(userId: string, accountId: string) {
    const account = await this.ownAccount(userId, accountId);
    return (await this.remoteFor(account)).listLists();
  }

  /** Cria (sem id) ou muda um grupo, e faz logo as ligações dele. */
  async saveGroup(userId: string, input: SaveTodoSyncGroupDto, id?: string) {
    const accountIds = [...new Set(input.accountIds)];
    for (const accountId of accountIds)
      await this.ownAccount(userId, accountId);
    const listNames = [
      ...new Set(input.listNames.map((name) => name.trim()).filter(Boolean)),
    ];
    if (!input.includeLocal && accountIds.length < 2)
      throw new BadRequestException(
        'Sem o servidor, escolhe pelo menos duas contas.',
      );
    if (input.scope === TodoSyncScope.LISTS && !listNames.length)
      throw new BadRequestException('Escolhe pelo menos uma lista, ou "Tudo".');
    if (id) {
      const exists = await this.prisma.todoSyncGroup.findFirst({
        where: { id, userId },
      });
      if (!exists) throw new NotFoundException('Este grupo já não existe.');
    }
    const data = {
      name: input.name.trim(),
      scope: input.scope,
      includeLocal: input.includeLocal,
      listNames: input.scope === TodoSyncScope.LISTS ? listNames : [],
      accountIds,
    };
    const group = id
      ? await this.prisma.todoSyncGroup.update({ where: { id }, data })
      : await this.prisma.todoSyncGroup.create({ data: { userId, ...data } });
    await this.linkGroup(group);

    const setting = await this.prisma.todoSyncSetting.findUnique({
      where: { userId },
    });
    if (setting?.enabled) this.runInBackground(userId);
    return this.overview(userId);
  }

  /** Uma volta sem esperar por ela: uma falha (ex.: da base de dados) fica no registo em vez de derrubar o Node. */
  private runInBackground(userId: string) {
    void this.runUser(userId).catch((error: unknown) =>
      this.logger.warn(`Sincronização das tarefas: ${errorText(error)}`),
    );
  }

  /**
   * Desfaz o grupo: as tarefas ficam como estão nas Tarefas e nas contas. Só saem as
   * listas escondidas (a ponte entre as contas), que eram cópias das de lá.
   */
  async removeGroup(userId: string, id: string) {
    const removed = await this.prisma.todoSyncGroup.deleteMany({
      where: { id, userId },
    });
    if (!removed.count)
      throw new NotFoundException('Este grupo já não existe.');
    // As listas escondidas que ligavam as contas deste grupo já não servem.
    await this.prisma.todoList.deleteMany({
      where: { userId, hidden: true, name: { startsWith: `__sync:${id}:` } },
    });
    return this.overview(userId);
  }

  /** "Sincronizar agora": corre os grupos já, com o automático ligado ou não. */
  async runNow(userId: string) {
    await this.runUser(userId);
    return this.overview(userId);
  }

  /** Uma volta a todos os grupos dele (refaz as ligações e sincroniza cada uma). */
  async runUser(userId: string) {
    if (this.running.has(userId)) return;
    this.running.add(userId);
    try {
      const groups = await this.prisma.todoSyncGroup.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });
      for (const group of groups) {
        await this.linkGroup(group);
        const links = await this.prisma.todoSyncLink.findMany({
          where: {
            groupId: group.id,
            account: { isActive: true, disconnectedAt: null },
          },
          orderBy: { createdAt: 'asc' },
        });
        for (const link of links) await this.runLink(link);
      }
    } finally {
      // Mesmo que a volta falhe a meio: senão o agendamento tentava outra vez a cada minuto.
      await this.prisma.todoSyncSetting
        .updateMany({ where: { userId }, data: { lastRunAt: new Date() } })
        .catch(() => undefined);
      this.running.delete(userId);
    }
  }

  /** Os que têm a sincronização ligada e já passou o intervalo deles (o agendamento). */
  async runDue() {
    const settings = await this.prisma.todoSyncSetting.findMany({
      where: { enabled: true },
      select: { userId: true, intervalMinutes: true, lastRunAt: true },
    });
    const now = Date.now();
    const due = settings.filter(
      (setting) =>
        !setting.lastRunAt ||
        now - setting.lastRunAt.getTime() >=
          setting.intervalMinutes * 60_000 - 30_000,
    );
    for (const { userId } of due) {
      await this.runUser(userId).catch((error: unknown) =>
        this.logger.warn(`Sincronização das tarefas: ${errorText(error)}`),
      );
    }
  }

  /**
   * Lê as listas de cada conta do grupo e faz as ligações. Uma conta que não responde
   * (ou está desligada) fica de fora desta vez, sem perder as ligações dela.
   */
  private async linkGroup(group: TodoSyncGroup) {
    const reachable: GroupAccount[] = [];
    const unreachable: string[] = [];
    const problems: string[] = [];
    // Uma conta apagada sai do grupo (as ligações dela já foram com ela).
    const gone: string[] = [];
    for (const accountId of group.accountIds) {
      const account = await this.prisma.connectedAccount.findFirst({
        where: {
          id: accountId,
          userId: group.userId,
          provider: { in: SYNC_PROVIDERS },
        },
      });
      if (!account) {
        gone.push(accountId);
        continue;
      }
      if (!account.isActive || account.disconnectedAt) {
        unreachable.push(accountId);
        continue;
      }
      try {
        const remote = await this.remoteFor(account);
        reachable.push({
          id: account.id,
          label: accountLabel(account),
          remote,
          lists: await remote.listLists(),
        });
      } catch (error) {
        unreachable.push(accountId);
        problems.push(`${accountLabel(account)}: ${errorText(error)}`);
      }
    }
    try {
      problems.push(
        ...(await reconcileGroup(this.prisma, group, reachable, unreachable)),
      );
    } catch (error) {
      problems.push(errorText(error));
    }
    await this.prisma.todoSyncGroup.update({
      where: { id: group.id },
      data: {
        ...(gone.length
          ? { accountIds: group.accountIds.filter((id) => !gone.includes(id)) }
          : {}),
        lastError: problems.length ? problems.join(' · ').slice(0, 1000) : null,
      },
    });
  }

  private async runLink(link: TodoSyncLink) {
    try {
      const account = await this.prisma.connectedAccount.findUniqueOrThrow({
        where: { id: link.accountId },
      });
      await syncLink(this.prisma, link, await this.remoteFor(account));
      await this.prisma.todoSyncLink.update({
        where: { id: link.id },
        data: { lastSyncAt: new Date(), lastError: null },
      });
    } catch (error) {
      await this.prisma.todoSyncLink
        .update({
          where: { id: link.id },
          data: { lastError: errorText(error).slice(0, 500) },
        })
        .catch(() => undefined);
    }
  }

  private async ownAccount(userId: string, accountId: string) {
    const account = await this.prisma.connectedAccount.findFirst({
      where: {
        id: accountId,
        userId,
        provider: { in: SYNC_PROVIDERS },
        disconnectedAt: null,
      },
    });
    if (!account) throw new NotFoundException('Esta conta já não existe.');
    return account;
  }

  /** As tarefas de uma conta: o Google com um token válido, o Nextcloud por CalDAV. */
  private async remoteFor(account: ConnectedAccount): Promise<TaskRemote> {
    if (account.provider === ConnectionProvider.NEXTCLOUD)
      return nextcloudTasksRemote(decryptAccount(account));
    return googleRemote(
      await ensureFreshAccessToken(account.id, this.accounts),
    );
  }
}
