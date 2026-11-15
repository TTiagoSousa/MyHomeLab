import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  NotificationKind,
  ServerConnection,
} from 'src/generated/prisma/client/client';
import { NotificationService } from 'src/notification/notification.service';
import { ServerConnectionService } from 'src/server-connection/server-connection.service';
import {
  createProxmoxClient,
  ProxmoxClient,
  ProxmoxDisk,
} from 'src/proxmox/proxmox.client';
import { parseSmart } from './helpers/parseSmart';
import { DiskIssue, DiskSnapshot, evaluateDisk } from './helpers/evaluateDisk';

/** Quantos dias para trás contam para dizer que um contador "subiu". */
const TREND_DAYS = 7;
/** Quantos dias de histórico vão para a página. */
const HISTORY_DAYS = 30;
/** As leituras mais antigas que isto apagam-se. */
const KEEP_DAYS = 400;
/** Pools e armazenamentos acima disto dão alerta laranja. */
const FULL_FRACTION = 0.9;

type Status = 'ok' | 'warning' | 'problem' | 'unknown';

export interface DiskHistoryPoint {
  day: string;
  temperature: number | null;
  wearout: number | null;
  reallocated: number | null;
  pending: number | null;
  mediaErrors: number | null;
}

export interface DiskView {
  key: string;
  devPath: string;
  model: string | null;
  serial: string | null;
  type: string | null;
  sizeBytes: number | null;
  health: string | null;
  wearout: number | null;
  temperature: number | null;
  reallocated: number | null;
  pending: number | null;
  mediaErrors: number | null;
  powerOnHours: number | null;
  status: Status;
  issues: DiskIssue[];
  history: DiskHistoryPoint[];
}

export interface PoolView {
  name: string;
  health: string;
  size: number;
  alloc: number;
  status: Status;
  issues: DiskIssue[];
}

export interface NodeDisksView {
  node: string;
  error: string | null;
  disks: DiskView[];
  pools: PoolView[];
}

export interface DisksOverview {
  checkedAt: Date;
  nodes: NodeDisksView[];
}

interface Alert {
  subject: string;
  title: string;
  issues: DiskIssue[];
}

const startOfDay = (offsetDays = 0) => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - offsetDays);
  return date;
};

const statusOf = (issues: DiskIssue[], known = true): Status => {
  if (issues.some((issue) => issue.level === 'problem')) return 'problem';
  if (issues.length) return 'warning';
  return known ? 'ok' : 'unknown';
};

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * A saúde dos discos dos servidores Proxmox: lê o SMART de cada disco físico,
 * guarda uma leitura por dia (a última do dia fica), compara com os dias
 * anteriores e abre/fecha os alertas — vermelho para o que está a falhar,
 * laranja para o que pede atenção.
 */
@Injectable()
export class DiskHealthService {
  private readonly logger = new Logger(DiskHealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly servers: ServerConnectionService,
  ) {}

  async overview(userId: string, serverId: string): Promise<DisksOverview> {
    const server = await this.prisma.serverConnection.findFirst({
      where: { id: serverId, userId },
    });
    if (!server) throw new NotFoundException('Servidor não encontrado');
    try {
      return await this.checkServer(server);
    } catch (error) {
      throw new BadGatewayException({
        code: 'SERVER_UNREACHABLE',
        message: errorText(error),
      });
    }
  }

  /** O resumo de todos os servidores do utilizador, para o Jarvis. */
  async overviewsFor(userId: string) {
    const servers = await this.prisma.serverConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    const result: {
      server: string;
      overview: DisksOverview | null;
      error: string | null;
    }[] = [];
    for (const server of servers) {
      try {
        result.push({
          server: server.name,
          overview: await this.checkServer(server),
          error: null,
        });
      } catch (error) {
        result.push({
          server: server.name,
          overview: null,
          error: errorText(error),
        });
      }
    }
    return result;
  }

  /** Para o agendador: todos os servidores de todos os utilizadores. */
  async checkAll(): Promise<void> {
    const servers = await this.prisma.serverConnection.findMany();
    for (const server of servers) {
      try {
        await this.checkServer(server);
      } catch (error) {
        // Servidor em baixo: não se mexe nos alertas que já existem.
        this.logger.warn(`Discos de ${server.name}: ${errorText(error)}`);
      }
    }
    await this.prisma.diskReading.deleteMany({
      where: { day: { lt: startOfDay(KEEP_DAYS) } },
    });
  }

  private async checkServer(server: ServerConnection): Promise<DisksOverview> {
    const connection = await this.servers.connectionById(server.id);
    if (!connection) throw new NotFoundException('Servidor não encontrado');
    const client = createProxmoxClient(connection);

    const resources = await client.clusterResources();
    const onlineNodes = resources
      .filter(
        (resource) => resource.type === 'node' && resource.status === 'online',
      )
      .map((resource) => resource.node ?? resource.id.replace(/^node\//, ''))
      .sort();

    const nodes: NodeDisksView[] = [];
    const alerts: Record<'problem' | 'warning', Alert[]> = {
      problem: [],
      warning: [],
    };
    let complete = true;

    for (const node of onlineNodes) {
      try {
        const view = await this.checkNode(server, client, node);
        nodes.push(view);
        for (const disk of view.disks) {
          this.collect(
            alerts,
            `disk:${node}:${disk.key}`,
            `${server.name}: disco ${disk.model ?? ''} (${disk.devPath}) em ${node}`,
            disk.issues,
          );
        }
        for (const pool of view.pools) {
          this.collect(
            alerts,
            `pool:${node}:${pool.name}`,
            `${server.name}: pool ZFS ${pool.name} em ${node}`,
            pool.issues,
          );
        }
      } catch (error) {
        complete = false;
        nodes.push({ node, error: errorText(error), disks: [], pools: [] });
      }
    }

    for (const storage of resources.filter(
      (resource) => resource.type === 'storage',
    )) {
      const fraction = storage.maxdisk
        ? (storage.disk ?? 0) / storage.maxdisk
        : 0;
      if (storage.status === 'available' && fraction >= FULL_FRACTION) {
        alerts.warning.push({
          subject: `storage:${storage.node}:${storage.storage}`,
          title: `${server.name}: armazenamento ${storage.storage} em ${storage.node}`,
          issues: [
            {
              level: 'warning',
              text: `está ${Math.round(fraction * 100)}% cheio`,
            },
          ],
        });
      }
    }

    await this.notify(
      server,
      NotificationKind.DISK_PROBLEM,
      alerts.problem,
      complete,
    );
    await this.notify(
      server,
      NotificationKind.DISK_WARNING,
      alerts.warning,
      complete,
    );

    return { checkedAt: new Date(), nodes };
  }

  private async checkNode(
    server: ServerConnection,
    client: ProxmoxClient,
    node: string,
  ): Promise<NodeDisksView> {
    const [disks, pools] = await Promise.all([
      client.listDisks(node),
      // Sem ZFS (ou sem o pacote), o Proxmox responde com erro — não há pools.
      client.listZfsPools(node).catch(() => []),
    ]);

    const views: DiskView[] = [];
    for (const disk of disks)
      views.push(await this.checkDisk(server, client, node, disk));

    const poolViews = pools.map((pool): PoolView => {
      const issues: DiskIssue[] = [];
      if (pool.health && pool.health !== 'ONLINE') {
        issues.push({ level: 'problem', text: `está ${pool.health}` });
      }
      const fraction = pool.size ? pool.alloc / pool.size : 0;
      if (fraction >= FULL_FRACTION) {
        issues.push({
          level: 'warning',
          text: `está ${Math.round(fraction * 100)}% cheia`,
        });
      }
      return {
        name: pool.name,
        health: pool.health,
        size: pool.size,
        alloc: pool.alloc,
        status: statusOf(issues),
        issues,
      };
    });

    return { node, error: null, disks: views, pools: poolViews };
  }

  private async checkDisk(
    server: ServerConnection,
    client: ProxmoxClient,
    node: string,
    disk: ProxmoxDisk,
  ): Promise<DiskView> {
    const smart = await client
      .diskSmart(node, disk.devpath)
      .then(parseSmart)
      .catch(() => null);

    const key = disk.serial?.trim() || disk.devpath;
    const diskType = disk.type ?? null;
    const listWearout = Number(disk.wearout);
    const snapshot: DiskSnapshot = {
      diskType,
      health: smart?.health ?? null,
      wearout:
        smart?.wearout ?? (Number.isFinite(listWearout) ? listWearout : null),
      temperature: smart?.temperature ?? null,
      reallocated: smart?.reallocated ?? null,
      pending: smart?.pending ?? null,
      mediaErrors: smart?.mediaErrors ?? null,
    };
    const powerOnHours = smart?.powerOnHours ?? null;

    const today = startOfDay();
    const reading = {
      devPath: disk.devpath,
      model: disk.model ?? null,
      serial: disk.serial ?? null,
      diskType,
      sizeBytes: disk.size != null ? BigInt(Math.round(disk.size)) : null,
      health: snapshot.health,
      wearout: snapshot.wearout,
      temperature: snapshot.temperature,
      reallocated: snapshot.reallocated,
      pending: snapshot.pending,
      mediaErrors: snapshot.mediaErrors,
      powerOnHours,
      takenAt: new Date(),
    };
    await this.prisma.diskReading.upsert({
      where: {
        serverConnectionId_node_diskKey_day: {
          serverConnectionId: server.id,
          node,
          diskKey: key,
          day: today,
        },
      },
      create: {
        serverConnectionId: server.id,
        node,
        diskKey: key,
        day: today,
        ...reading,
      },
      update: reading,
    });

    const history = await this.prisma.diskReading.findMany({
      where: {
        serverConnectionId: server.id,
        node,
        diskKey: key,
        day: { gte: startOfDay(HISTORY_DAYS) },
      },
      orderBy: { day: 'asc' },
    });
    const trendStart = startOfDay(TREND_DAYS).getTime();
    const previous = history.filter(
      (row) =>
        row.day.getTime() >= trendStart && row.day.getTime() < today.getTime(),
    );

    const issues = evaluateDisk(snapshot, previous);
    return {
      key,
      devPath: disk.devpath,
      model: disk.model ?? null,
      serial: disk.serial ?? null,
      type: diskType,
      sizeBytes: disk.size ?? null,
      health: snapshot.health,
      wearout: snapshot.wearout,
      temperature: snapshot.temperature,
      reallocated: snapshot.reallocated,
      pending: snapshot.pending,
      mediaErrors: snapshot.mediaErrors,
      powerOnHours,
      status: statusOf(issues, smart != null && smart.health != null),
      issues,
      history: history.map((row) => ({
        day: row.day.toISOString().slice(0, 10),
        temperature: row.temperature,
        wearout: row.wearout,
        reallocated: row.reallocated,
        pending: row.pending,
        mediaErrors: row.mediaErrors,
      })),
    };
  }

  private collect(
    alerts: Record<'problem' | 'warning', Alert[]>,
    subject: string,
    title: string,
    issues: DiskIssue[],
  ) {
    for (const level of ['problem', 'warning'] as const) {
      const matching = issues.filter((issue) => issue.level === level);
      if (matching.length)
        alerts[level].push({ subject, title, issues: matching });
    }
  }

  /**
   * Abre (ou atualiza) um alerta por assunto e fecha os que já não se aplicam —
   * só quando todos os nós foram lidos, para um nó que não respondeu não fechar
   * alertas que continuam válidos.
   */
  private async notify(
    server: ServerConnection,
    kind: NotificationKind,
    alerts: Alert[],
    complete: boolean,
  ) {
    for (const alert of alerts) {
      const text = alert.issues.map((issue) => issue.text).join('; ');
      await this.notifications.openForSubject({
        userId: server.userId,
        serverConnectionId: server.id,
        subject: alert.subject,
        kind,
        title: alert.title.replace(/\s+/g, ' '),
        message: `${text.charAt(0).toUpperCase()}${text.slice(1)}.`,
      });
    }
    if (complete) {
      await this.notifications.resolveSubjectsExcept(
        server.id,
        kind,
        alerts.map((alert) => alert.subject),
      );
    }
  }
}
