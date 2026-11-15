import {
  BadRequestException,
  ConflictException,
  Injectable,
  BadGatewayException,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  NotificationKind,
  Role,
  ServerConnection,
} from 'src/generated/prisma/client/client';
import { NotificationService } from 'src/notification/notification.service';
import { encryptToken, decryptToken } from 'src/utils/crypto/token-cipher';
import {
  createProxmoxClient,
  normalizeHost,
  ProxmoxConnection,
  RrdTimeframe,
} from 'src/proxmox/proxmox.client';
import {
  CreateServerConnectionDto,
  UpdateServerConnectionDto,
} from './dto/save-server-connection.dto';
import {
  buildServerDashboard,
  ServerDashboard,
} from './helpers/buildServerDashboard';
import { ServerUpdates, serverUpdates } from './helpers/serverUpdates';

const TIMEFRAMES: RrdTimeframe[] = ['hour', 'day', 'week', 'month'];

export interface ServerConnectionView {
  id: string;
  kind: string;
  name: string;
  host: string;
  port: number;
  tokenId: string;
  verifyTls: boolean;
  updatedAt: Date;
  sshEnabled: boolean;
  sshUser: string | null;
  sshPort: number;
  sshPublicKey: string | null;
}

export interface ServerCheck {
  ok: boolean;
  version?: string;
  nodes?: number;
  guests?: number;
  running?: number;
  error?: string;
}

const toView = (row: ServerConnection): ServerConnectionView => ({
  id: row.id,
  kind: row.kind.toLowerCase(),
  name: row.name,
  host: row.host,
  port: row.port,
  tokenId: row.tokenId,
  verifyTls: row.verifyTls,
  updatedAt: row.updatedAt,
  sshEnabled: Boolean(row.sshPrivateKey),
  sshUser: row.sshUser,
  sshPort: row.sshPort,
  sshPublicKey: row.sshPublicKey,
});

export const toProxmoxConnection = (
  row: ServerConnection,
): ProxmoxConnection => ({
  id: row.id,
  name: row.name,
  host: row.host,
  port: row.port,
  tokenId: row.tokenId,
  tokenSecret: decryptToken(row.tokenSecret),
  verifyTls: row.verifyTls,
});

/**
 * Os servidores que o agente de servidor consulta (Apps ligadas → Proxmox).
 * Cada utilizador tem os seus; o segredo do token guarda-se cifrado e nunca volta
 * ao browser.
 */
@Injectable()
export class ServerConnectionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ServerConnectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * Antes, o Proxmox configurava-se nas variáveis PROXMOX_* do servidor. Para quem
   * atualiza não ter de o voltar a configurar, no primeiro arranque essas
   * variáveis passam a um servidor "Proxmox" do primeiro admin — só se ainda não
   * houver servidor nenhum na base de dados.
   */
  async onApplicationBootstrap(): Promise<void> {
    const host = process.env.PROXMOX_HOST?.trim();
    const tokenName = process.env.PROXMOX_TOKEN_NAME?.trim();
    const tokenSecret = process.env.PROXMOX_TOKEN_VALUE?.trim();
    if (!host || !tokenName || !tokenSecret) return;

    try {
      if ((await this.prisma.serverConnection.count()) > 0) return;

      const admin = await this.prisma.user.findFirst({
        where: { role: Role.ADMIN },
        orderBy: { createdAt: 'asc' },
      });
      if (!admin) return;

      const user = process.env.PROXMOX_USER?.trim() || 'root@pam';
      await this.prisma.serverConnection.create({
        data: {
          userId: admin.id,
          name: 'Proxmox',
          host: normalizeHost(host),
          tokenId: tokenName.includes('!') ? tokenName : `${user}!${tokenName}`,
          tokenSecret: encryptToken(tokenSecret),
        },
      });
      this.logger.log(
        `Proxmox das variáveis PROXMOX_* importado para ${admin.username} (Apps ligadas → Proxmox).`,
      );
    } catch (error) {
      this.logger.warn(
        `Não foi possível importar o Proxmox das variáveis de ambiente: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async list(userId: string): Promise<ServerConnectionView[]> {
    const rows = await this.prisma.serverConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toView);
  }

  /** Os servidores com o segredo em claro, para o agente. */
  async view(userId: string, id: string): Promise<ServerConnectionView> {
    return toView(await this.findOwned(userId, id));
  }

  async connectionsFor(userId: string): Promise<ProxmoxConnection[]> {
    const rows = await this.prisma.serverConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toProxmoxConnection);
  }

  async create(
    userId: string,
    dto: CreateServerConnectionDto,
  ): Promise<ServerConnectionView> {
    const conn: ProxmoxConnection = {
      name: dto.name.trim(),
      host: normalizeHost(dto.host),
      port: dto.port ?? 8006,
      tokenId: dto.tokenId.trim(),
      tokenSecret: dto.tokenSecret.trim(),
      verifyTls: dto.verifyTls ?? false,
    };
    await this.assertNameFree(userId, conn.name);
    await this.assertWorks(conn);

    const row = await this.prisma.serverConnection.create({
      data: {
        userId,
        ...conn,
        tokenSecret: encryptToken(conn.tokenSecret),
      },
    });
    return toView(row);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateServerConnectionDto,
  ): Promise<ServerConnectionView> {
    const current = await this.findOwned(userId, id);
    const before = toProxmoxConnection(current);

    const next: ProxmoxConnection = {
      name: dto.name?.trim() || before.name,
      host: dto.host ? normalizeHost(dto.host) : before.host,
      port: dto.port ?? before.port,
      tokenId: dto.tokenId?.trim() || before.tokenId,
      tokenSecret: dto.tokenSecret?.trim() || before.tokenSecret,
      verifyTls: dto.verifyTls ?? before.verifyTls,
    };
    if (next.name !== before.name) await this.assertNameFree(userId, next.name);

    // Só se volta a testar quando muda algo da ligação — renomear não precisa.
    const connectionChanged =
      next.host !== before.host ||
      next.port !== before.port ||
      next.tokenId !== before.tokenId ||
      next.tokenSecret !== before.tokenSecret ||
      next.verifyTls !== before.verifyTls;
    if (connectionChanged) await this.assertWorks(next);

    const row = await this.prisma.serverConnection.update({
      where: { id },
      data: { ...next, tokenSecret: encryptToken(next.tokenSecret) },
    });
    return toView(row);
  }

  /**
   * Um servidor com serviços associados só sai com `force`: a resposta 409 diz
   * quais são, e com `force` os serviços ficam, só sem servidor nem máquina.
   */
  async remove(userId: string, id: string, force = false): Promise<void> {
    await this.findOwned(userId, id);

    const linked = await this.prisma.serviceMonitor.findMany({
      where: { serverConnectionId: id },
      select: { id: true, name: true },
    });
    if (linked.length && !force) {
      throw new ConflictException({
        code: 'SERVER_HAS_SERVICES',
        message: `Este servidor tem serviços associados: ${linked.map((m) => m.name).join(', ')}.`,
        services: linked.map((m) => m.name),
      });
    }

    await this.prisma.serviceMonitor.updateMany({
      where: { serverConnectionId: id },
      data: {
        serverConnectionId: null,
        guestVmid: null,
        guestName: null,
        guestMissing: false,
      },
    });
    await this.prisma.serverConnection.delete({ where: { id } });
  }

  /** Para o agendador dos serviços: a ligação de um servidor pelo id. */
  async connectionById(id: string): Promise<ProxmoxConnection | null> {
    const row = await this.prisma.serverConnection.findUnique({
      where: { id },
    });
    return row ? toProxmoxConnection(row) : null;
  }

  /** As VMs e containers de um servidor, para associar um serviço a uma máquina. */
  async guests(userId: string, id: string) {
    const conn = toProxmoxConnection(await this.findOwned(userId, id));
    try {
      const resources = await createProxmoxClient(conn).clusterResources();
      return resources
        .filter(
          (resource) =>
            (resource.type === 'qemu' || resource.type === 'lxc') &&
            resource.template !== 1,
        )
        .map((resource) => ({
          vmid: resource.vmid ?? 0,
          name: resource.name ?? String(resource.vmid),
          type: resource.type,
          node: resource.node ?? '',
          status: resource.status ?? 'unknown',
        }))
        .sort((a, b) => a.vmid - b.vmid);
    } catch (error) {
      throw new BadGatewayException({
        code: 'SERVER_UNREACHABLE',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** O cartão do servidor mostra isto: versão, nós e máquinas, ou o erro. */
  async check(userId: string, id: string): Promise<ServerCheck> {
    return this.probe(toProxmoxConnection(await this.findOwned(userId, id)));
  }

  /** O dashboard da página Servidores: nós, storages, máquinas e histórico. */
  async dashboard(
    userId: string,
    id: string,
    timeframe: string | undefined,
  ): Promise<ServerDashboard> {
    const conn = toProxmoxConnection(await this.findOwned(userId, id));
    const frame = TIMEFRAMES.includes(timeframe as RrdTimeframe)
      ? (timeframe as RrdTimeframe)
      : 'hour';
    try {
      return await buildServerDashboard(createProxmoxClient(conn), frame);
    } catch (error) {
      // O servidor existe mas não respondeu: é o Proxmox que falha, não o pedido.
      throw new BadGatewayException({
        code: 'SERVER_UNREACHABLE',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** O que há para atualizar nos nós (e fecha o aviso antigo de versão nova do Proxmox VE). */
  async updates(userId: string, id: string): Promise<ServerUpdates> {
    const row = await this.findOwned(userId, id);
    try {
      const result = await serverUpdates(
        createProxmoxClient(toProxmoxConnection(row)),
      );
      await this.notifyUpdates(row);
      return result;
    } catch (error) {
      throw new BadGatewayException({
        code: 'SERVER_UNREACHABLE',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private updatesListener?: (
    server: ServerConnection,
    result: ServerUpdates,
  ) => Promise<void>;

  /** O fluxo das atualizações ouve aqui o que há por atualizar no host (versão do Proxmox VE e pacotes do sistema). */
  onUpdatesChecked(
    listener: (
      server: ServerConnection,
      result: ServerUpdates,
    ) => Promise<void>,
  ) {
    this.updatesListener = listener;
  }

  /** De 6 em 6 horas, para todos os servidores; um que falhe não trava os outros. */
  async checkAllUpdates(): Promise<void> {
    for (const row of await this.prisma.serverConnection.findMany()) {
      await serverUpdates(createProxmoxClient(toProxmoxConnection(row)))
        .then(async (result) => {
          await this.notifyUpdates(row);
          await this.updatesListener?.(row, result);
        })
        .catch(() => undefined);
    }
  }

  /**
   * A versão nova do Proxmox já não abre aviso: vira a atualização e a tarefa do quadro,
   * e é lá que o agente pergunta. Fecha-se só o aviso "tem atualização" de antes.
   */
  private async notifyUpdates(row: ServerConnection) {
    await this.notifications.resolveUserSubject(
      row.userId,
      `update:server:${row.id}`,
      NotificationKind.APP_UPDATE,
    );
  }

  private async probe(conn: ProxmoxConnection): Promise<ServerCheck> {
    const client = createProxmoxClient(conn);
    try {
      const version = await client.version();
      const nodes = await client.listNodes();
      const guests = await client.listGuests();
      return {
        ok: true,
        version: version.version,
        nodes: nodes.length,
        guests: guests.length,
        running: guests.filter((ref) => ref.guest.status === 'running').length,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Um servidor só se grava se responder — senão o erro só aparecia ao perguntar
  // ao Jarvis.
  private async assertWorks(conn: ProxmoxConnection): Promise<void> {
    const result = await this.probe(conn);
    if (!result.ok) {
      throw new BadRequestException({
        code: 'SERVER_UNREACHABLE',
        message: result.error,
      });
    }
  }

  private async assertNameFree(userId: string, name: string): Promise<void> {
    const existing = await this.prisma.serverConnection.findUnique({
      where: { userId_name: { userId, name } },
    });
    if (existing) {
      throw new ConflictException({
        code: 'SERVER_NAME_TAKEN',
        message: `Já tens um servidor chamado "${name}".`,
      });
    }
  }

  private async findOwned(userId: string, id: string) {
    const row = await this.prisma.serverConnection.findFirst({
      where: { id, userId },
    });
    if (!row) throw new NotFoundException('Servidor não encontrado');
    return row;
  }
}
