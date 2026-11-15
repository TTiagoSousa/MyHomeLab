import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  MonitorKind,
  MonitorStatus,
  NotificationKind,
  Prisma,
  ServiceMonitor,
} from 'src/generated/prisma/client/client';
import { NotificationService } from 'src/notification/notification.service';
import { ServerConnectionService } from 'src/server-connection/server-connection.service';
import { createProxmoxClient } from 'src/proxmox/proxmox.client';
import { mapWithLimit } from 'src/utils/concurrency/mapWithLimit';
import { appLabel } from 'src/docs/docs.service';
import { CheckResult, checkTarget } from './helpers/checkTarget';
import { appMonitorTarget } from './helpers/appMonitorTarget';
import { ServiceDownTaskService } from './service-down-task.service';
import { SaveServiceMonitorDto } from './dto/save-service-monitor.dto';

const RETRY_AFTER_MS = 10_000;
const CONCURRENCY = 5;
const APP_INTERVAL_MINUTES = 5;

const withServer = {
  serverConnection: { select: { id: true, name: true } },
  account: { select: { id: true, provider: true, displayName: true } },
};

type MonitorWithServer = Prisma.ServiceMonitorGetPayload<{
  include: typeof withServer;
}>;

const toView = (monitor: MonitorWithServer) => ({
  id: monitor.id,
  name: monitor.name,
  kind: monitor.kind,
  target: monitor.target,
  intervalMinutes: monitor.intervalMinutes,
  server: monitor.serverConnection,
  guestVmid: monitor.guestVmid,
  guestName: monitor.guestName,
  guestMissing: monitor.guestMissing,
  app: monitor.account
    ? { id: monitor.account.id, name: appLabel(monitor.account) }
    : null,
  downTaskId: monitor.downTaskId,
  status: monitor.status,
  lastCheckedAt: monitor.lastCheckedAt,
  lastLatencyMs: monitor.lastLatencyMs,
  lastError: monitor.lastError,
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Os serviços que cada utilizador quer vigiar. Uma falha volta a ser testada ao
 * fim de 10 s antes de contar — um soluço da rede não deve gerar notificação.
 */
@Injectable()
export class ServiceMonitorService {
  private readonly logger = new Logger(ServiceMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly servers: ServerConnectionService,
    private readonly downTasks: ServiceDownTaskService,
  ) {}

  async list(userId: string) {
    await this.syncApps(userId);
    const monitors = await this.prisma.serviceMonitor.findMany({
      where: { userId },
      include: withServer,
      orderBy: { createdAt: 'asc' },
    });
    return monitors.map(toView);
  }

  async create(userId: string, dto: SaveServiceMonitorDto) {
    const data = await this.validate(userId, dto);
    const monitor = await this.prisma.serviceMonitor.create({
      data: { userId, ...data },
    });
    return this.check(monitor);
  }

  async update(userId: string, id: string, dto: SaveServiceMonitorDto) {
    const current = await this.findOwned(userId, id);
    const validated = await this.validate(userId, dto);
    // O de uma app: o endereço, o servidor e a máquina vêm da app (Apps ligadas).
    const data = current.accountId
      ? {
          ...validated,
          kind: current.kind,
          target: current.target,
          serverConnectionId: current.serverConnectionId,
          guestVmid: current.guestVmid,
          guestName: current.guestName,
        }
      : validated;

    const targetChanged =
      current.kind !== data.kind || current.target !== data.target;
    const monitor = await this.prisma.serviceMonitor.update({
      where: { id },
      data: {
        ...data,
        ...(targetChanged
          ? { status: MonitorStatus.UNKNOWN, lastError: null }
          : {}),
        ...(data.guestVmid !== current.guestVmid
          ? { guestMissing: false }
          : {}),
      },
    });
    if (data.guestVmid !== current.guestVmid) {
      await this.notifications.resolve(id, NotificationKind.MACHINE_MISSING);
    }
    return this.check(monitor);
  }

  async remove(userId: string, id: string) {
    const monitor = await this.findOwned(userId, id);
    if (monitor.accountId) {
      throw new BadRequestException({
        code: 'MONITOR_FROM_APP',
        message:
          'Este serviço vem de uma app ligada: para deixar de o vigiar, tira-lhe o servidor em Apps ligadas.',
      });
    }
    await this.prisma.serviceMonitor.delete({ where: { id } });
  }

  async checkNow(userId: string, id: string) {
    return this.check(await this.findOwned(userId, id));
  }

  /**
   * As apps ligadas que dizem onde correm (servidor e, se houver, CT/VM) e têm um
   * endereço ganham um serviço vigiado; quando deixam de o dizer, ele sai. Corre no
   * agendador (de 30 em 30 s) e ao abrir a lista, para não ter de mexer nas contas.
   */
  async syncApps(userId?: string): Promise<void> {
    const accounts = await this.prisma.connectedAccount.findMany({
      where: {
        ...(userId ? { userId } : {}),
        serverConnectionId: { not: null },
        disconnectedAt: null,
      },
      include: { serviceMonitor: true },
    });
    const kept: string[] = [];
    for (const account of accounts) {
      const target = appMonitorTarget(account);
      if (!target) continue;
      kept.push(account.id);
      const monitor = account.serviceMonitor;
      if (!monitor) {
        await this.prisma.serviceMonitor.create({
          data: {
            userId: account.userId,
            accountId: account.id,
            name: appLabel(account).slice(0, 60),
            kind: MonitorKind.HTTP,
            target,
            intervalMinutes: APP_INTERVAL_MINUTES,
            serverConnectionId: account.serverConnectionId,
            guestVmid: account.guestVmid,
          },
        });
        continue;
      }
      const targetChanged =
        monitor.target !== target || monitor.kind !== MonitorKind.HTTP;
      const machineChanged =
        monitor.serverConnectionId !== account.serverConnectionId ||
        monitor.guestVmid !== account.guestVmid;
      if (!targetChanged && !machineChanged) continue;
      await this.prisma.serviceMonitor.update({
        where: { id: monitor.id },
        data: {
          kind: MonitorKind.HTTP,
          target,
          serverConnectionId: account.serverConnectionId,
          guestVmid: account.guestVmid,
          ...(targetChanged
            ? { status: MonitorStatus.UNKNOWN, lastError: null }
            : {}),
          ...(machineChanged ? { guestName: null, guestMissing: false } : {}),
        },
      });
      if (machineChanged) {
        await this.notifications.resolve(
          monitor.id,
          NotificationKind.MACHINE_MISSING,
        );
      }
    }
    await this.prisma.serviceMonitor.deleteMany({
      where: {
        ...(userId ? { userId } : {}),
        accountId: { not: null, notIn: kept },
      },
    });
  }

  /** Para o agendador: os serviços cujo intervalo já passou. */
  async checkDue(): Promise<void> {
    const now = Date.now();
    const monitors = await this.prisma.serviceMonitor.findMany();
    const due = monitors.filter(
      (monitor) =>
        !monitor.lastCheckedAt ||
        now - monitor.lastCheckedAt.getTime() >=
          monitor.intervalMinutes * 60_000,
    );
    await mapWithLimit(due, CONCURRENCY, (monitor) => this.check(monitor));
  }

  /**
   * Para o agendador: confirma que as máquinas associadas ainda existem no
   * Proxmox. Uma chamada a /cluster/resources por servidor.
   */
  async checkMachines(): Promise<void> {
    const monitors = await this.prisma.serviceMonitor.findMany({
      where: { serverConnectionId: { not: null }, guestVmid: { not: null } },
    });
    const byServer = new Map<string, ServiceMonitor[]>();
    for (const monitor of monitors) {
      const list = byServer.get(monitor.serverConnectionId!) ?? [];
      list.push(monitor);
      byServer.set(monitor.serverConnectionId!, list);
    }

    for (const [serverId, serverMonitors] of byServer) {
      const connection = await this.servers.connectionById(serverId);
      if (!connection) continue;

      let vmids: Set<number>;
      let resources: Awaited<
        ReturnType<ReturnType<typeof createProxmoxClient>['clusterResources']>
      >;
      try {
        resources = await createProxmoxClient(connection).clusterResources();
        vmids = new Set(
          resources
            .filter(
              (resource) => resource.type === 'qemu' || resource.type === 'lxc',
            )
            .map((resource) => resource.vmid ?? -1),
        );
      } catch {
        continue;
      }

      for (const monitor of serverMonitors) {
        const missing = !vmids.has(monitor.guestVmid!);
        // Os das apps chegam só com o vmid: o nome da máquina vem daqui.
        const guestName = monitor.guestName
          ? null
          : resources.find((resource) => resource.vmid === monitor.guestVmid)
              ?.name;
        if (guestName) {
          await this.prisma.serviceMonitor.update({
            where: { id: monitor.id },
            data: { guestName },
          });
        }
        if (missing === monitor.guestMissing) continue;

        await this.prisma.serviceMonitor.update({
          where: { id: monitor.id },
          data: { guestMissing: missing },
        });
        if (missing) {
          await this.notifications.open({
            userId: monitor.userId,
            monitorId: monitor.id,
            kind: NotificationKind.MACHINE_MISSING,
            title: `A máquina de ${monitor.name} desapareceu`,
            message: `${monitor.guestName ?? `VM ${monitor.guestVmid}`} (ID ${monitor.guestVmid}) já não existe em ${connection.name}. Associa o serviço a outra máquina ou tira a associação.`,
          });
        } else {
          await this.notifications.resolve(
            monitor.id,
            NotificationKind.MACHINE_MISSING,
          );
        }
      }
    }
  }

  private async check(monitor: ServiceMonitor) {
    let result = await checkTarget(monitor.kind, monitor.target);
    if (!result.up) {
      await sleep(RETRY_AFTER_MS);
      result = await checkTarget(monitor.kind, monitor.target);
    }

    const updated = await this.prisma.serviceMonitor.update({
      where: { id: monitor.id },
      data: {
        status: result.up ? MonitorStatus.UP : MonitorStatus.DOWN,
        lastCheckedAt: new Date(),
        lastLatencyMs: result.latencyMs,
        lastError: result.error,
      },
      include: withServer,
    });

    if (result.up) {
      await this.notifications.resolve(
        monitor.id,
        NotificationKind.SERVICE_DOWN,
      );
    } else {
      await this.notifications.open({
        userId: monitor.userId,
        monitorId: monitor.id,
        kind: NotificationKind.SERVICE_DOWN,
        title: `${monitor.name} está em baixo`,
        message: `${monitor.target} — ${result.error ?? 'sem resposta'}`,
      });
    }
    await this.recordOnBoard(
      monitor,
      result,
      updated.lastCheckedAt ?? new Date(),
    );
    return toView(updated);
  }

  /**
   * A falha vira tarefa (e o agente é disparado); a recuperação fica comentada nela.
   * Um erro aqui não estraga a verificação: fica no registo.
   */
  private async recordOnBoard(
    monitor: ServiceMonitor,
    result: CheckResult,
    at: Date,
  ) {
    try {
      if (result.up) await this.downTasks.cameBack(monitor, result, at);
      else await this.downTasks.wentDown(monitor, result, at);
    } catch (error) {
      this.logger.warn(
        `Tarefa da falha de ${monitor.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async validate(userId: string, dto: SaveServiceMonitorDto) {
    const target = dto.target.trim();
    const kind = dto.kind;
    if (kind === MonitorKind.HTTP && !/^https?:\/\/\S+$/i.test(target)) {
      throw new BadRequestException({
        code: 'MONITOR_TARGET_INVALID',
        message:
          'Para HTTP, o endereço tem de começar por http:// ou https://.',
      });
    }
    if (kind === MonitorKind.TCP && !/^\[?[^\s\]]+\]?:\d{1,5}$/.test(target)) {
      throw new BadRequestException({
        code: 'MONITOR_TARGET_INVALID',
        message: 'Para TCP, o endereço é host:porta, ex: 192.168.1.10:53.',
      });
    }

    const serverConnectionId = dto.serverConnectionId || null;
    if (serverConnectionId) {
      const owned = await this.prisma.serverConnection.findFirst({
        where: { id: serverConnectionId, userId },
      });
      if (!owned) throw new NotFoundException('Servidor não encontrado');
    }

    return {
      name: dto.name.trim(),
      kind,
      target,
      intervalMinutes: dto.intervalMinutes,
      serverConnectionId,
      guestVmid: serverConnectionId ? (dto.guestVmid ?? null) : null,
      guestName:
        serverConnectionId && dto.guestVmid != null
          ? (dto.guestName ?? null)
          : null,
    };
  }

  private async findOwned(userId: string, id: string) {
    const monitor = await this.prisma.serviceMonitor.findFirst({
      where: { id, userId },
    });
    if (!monitor) throw new NotFoundException('Serviço não encontrado');
    return monitor;
  }
}
