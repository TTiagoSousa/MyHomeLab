import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { ensureFreshAccessToken } from 'src/connected-account/helpers/ensureFreshAccessToken';
import {
  getMailboxStats,
  listLabels,
} from 'src/email-rule/google/gmail-api.client';
import { createProxmoxClient } from 'src/proxmox/proxmox.client';
import { toProxmoxConnection } from 'src/server-connection/server-connection.service';
import {
  ConnectedAccount,
  ConnectionProvider,
  DocKind,
  DocLinkType,
  DocOwner,
  ServerConnection,
  ServiceMonitor,
} from 'src/generated/prisma/client/client';
import { accountLinkLabel, PROVIDER_NAMES } from '../docs.service';
import { MAP_TAG } from './mapContent';
import { appMap, GmailFacts, serverMap, ServerFacts } from './mapBuilders';

const DAY_MS = 24 * 60 * 60 * 1000;
const AUTHOR = 'MyHomeLab';

type Account = ConnectedAccount & {
  serverConnection: { name: string } | null;
};

const reason = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, 120);

/**
 * Os mapas automáticos: um por servidor e um por app ligada, escritos pelo MyHomeLab
 * com o que ele já sabe (sem IA). Cria-se o que falta de 15 em 15 minutos e refaz-se
 * cada um uma vez por dia — ou já, pelo botão "Atualizar mapas". A secção "Notas" de
 * cada mapa é do utilizador e dos agentes e passa intacta de uma versão para a outra.
 */
@Injectable()
export class DocMapsService {
  private readonly logger = new Logger(DocMapsService.name);
  private readonly refreshedAt = new Map<string, number>();
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: PrismaConnectedAccountRepository,
  ) {}

  @Cron('0 */15 * * * *', { name: 'Mapas dos documentos' })
  async refreshDue() {
    if (this.running) return;
    this.running = true;
    try {
      const users = await this.prisma.user.findMany({ select: { id: true } });
      for (const user of users) await this.refreshUser(user.id, false);
    } catch (error) {
      this.logger.error(`Falha ao refazer os mapas: ${reason(error)}`);
    } finally {
      this.running = false;
    }
  }

  /** Refaz os mapas de um utilizador; sem `force`, só os que faltam ou têm mais de um dia. */
  async refreshUser(userId: string, force = true): Promise<number> {
    const [servers, accounts, monitors] = await Promise.all([
      this.prisma.serverConnection.findMany({ where: { userId } }),
      this.prisma.connectedAccount.findMany({
        where: { userId, disconnectedAt: null },
        include: { serverConnection: { select: { name: true } } },
      }),
      this.prisma.serviceMonitor.findMany({ where: { userId } }),
    ]);

    await this.relabelLinks(userId, servers, accounts);

    let written = 0;
    const jobs: [string, () => Promise<void>][] = [
      ...servers.map((server): [string, () => Promise<void>] => [
        `SERVER:${server.id}`,
        () => this.writeServerMap(userId, server, accounts, monitors),
      ]),
      ...accounts.map((account): [string, () => Promise<void>] => [
        `APP:${account.id}`,
        () => this.writeAppMap(userId, account),
      ]),
    ];
    for (const [key, job] of jobs) {
      const at = this.refreshedAt.get(key);
      if (!force && at && Date.now() - at < DAY_MS) continue;
      try {
        await job();
        written += 1;
      } catch (error) {
        this.logger.warn(`Mapa ${key} por refazer: ${reason(error)}`);
      }
      this.refreshedAt.set(key, Date.now());
    }
    return written;
  }

  /**
   * O nome de uma ligação fica o do momento em que se ligou: acerta-o com o de agora,
   * para os grupos dos Documentos dizerem "Gmail · eu@gmail.com" e não só "Gmail".
   */
  private async relabelLinks(
    userId: string,
    servers: ServerConnection[],
    accounts: Account[],
  ) {
    const links = [
      ...servers.map((server) => ({
        type: DocLinkType.SERVER,
        targetId: server.id,
        label: server.name,
      })),
      ...accounts.map((account) => ({
        type: DocLinkType.APP,
        targetId: account.id,
        label: accountLinkLabel(account),
      })),
    ];
    for (const link of links) {
      await this.prisma.docLink.updateMany({
        where: {
          type: link.type,
          targetId: link.targetId,
          doc: { userId },
          NOT: { label: link.label },
        },
        data: { label: link.label },
      });
    }
  }

  private async writeServerMap(
    userId: string,
    server: ServerConnection,
    accounts: Account[],
    monitors: ServiceMonitor[],
  ) {
    const facts: ServerFacts = {
      name: server.name,
      host: server.host,
      port: server.port,
      sshEnabled: Boolean(server.sshPrivateKey),
      nodes: [],
      guests: [],
      storages: [],
      apps: accounts
        .filter((account) => account.serverConnectionId === server.id)
        .map((account) => ({
          label: accountLinkLabel(account),
          vmid: account.guestVmid,
        })),
      monitors: monitors
        .filter((monitor) => monitor.serverConnectionId === server.id)
        .map((monitor) => monitor.name)
        .sort((a, b) => a.localeCompare(b, 'pt')),
    };

    try {
      const client = createProxmoxClient(toProxmoxConnection(server));
      const [resources, version] = await Promise.all([
        client.clusterResources(),
        client.version(),
      ]);
      facts.version = version.version;
      for (const resource of resources) {
        if (resource.type === 'node') {
          facts.nodes.push({
            node: resource.node ?? resource.name ?? resource.id,
            status: resource.status,
            maxcpu: resource.maxcpu,
            maxmem: resource.maxmem,
            uptime: resource.uptime,
          });
        } else if (resource.type === 'qemu' || resource.type === 'lxc') {
          facts.guests.push({
            vmid: resource.vmid ?? 0,
            kind: resource.type,
            name: resource.name ?? '',
            node: resource.node ?? '—',
            status: resource.status,
            maxcpu: resource.maxcpu,
            maxmem: resource.maxmem,
            maxdisk: resource.maxdisk,
            template: resource.template === 1,
          });
        } else if (resource.type === 'storage' && resource.storage) {
          const shared = resource.shared === 1;
          if (
            shared &&
            facts.storages.some((item) => item.storage === resource.storage)
          )
            continue;
          facts.storages.push({
            storage: resource.storage,
            node: resource.node,
            type: resource.plugintype,
            used: resource.disk,
            total: resource.maxdisk,
            shared,
          });
        }
      }
    } catch (error) {
      facts.error = reason(error);
    }

    await this.upsertMap(
      userId,
      { type: DocLinkType.SERVER, targetId: server.id, label: server.name },
      `Mapa – ${server.name}`,
      `O que existe no servidor ${server.name}: nós, máquinas (VMs e CTs), armazenamento e as apps que lá correm. Gerado pelo MyHomeLab; as Notas são tuas.`,
      ['servidor', 'proxmox'],
      (title, existing) => serverMap(title, facts, existing),
    );
  }

  private async gmailFacts(account: Account): Promise<GmailFacts> {
    const [rules, activeRules] = await Promise.all([
      this.prisma.emailRule.count({ where: { accountId: account.id } }),
      this.prisma.emailRule.count({
        where: { accountId: account.id, isActive: true },
      }),
    ]);
    const facts: GmailFacts = {
      rules,
      activeRules,
      frequency: account.runFrequency,
      lastRunAt: account.lastRunAt,
      proposalFrequency: account.proposalFrequency,
      labels: [],
    };
    try {
      const token = await ensureFreshAccessToken(account.id, this.accounts);
      const [labels, stats] = await Promise.all([
        listLabels(token),
        getMailboxStats(token),
      ]);
      facts.labels = labels
        .filter((label) => label.id.startsWith('Label_'))
        .map((label) => label.name);
      facts.inboxTotal = stats.inboxTotal;
      facts.inboxUnread = stats.inboxUnread;
      facts.mailboxTotal = stats.mailboxTotal;
    } catch (error) {
      facts.error = reason(error);
    }
    return facts;
  }

  private async writeAppMap(userId: string, account: Account) {
    const label = accountLinkLabel(account);
    const app = PROVIDER_NAMES[account.provider];
    const runsOn = account.serverConnection
      ? account.guestVmid != null
        ? `máquina ${account.guestVmid} do servidor ${account.serverConnection.name}`
        : `servidor ${account.serverConnection.name}`
      : null;
    const gmail =
      account.provider === ConnectionProvider.GMAIL
        ? await this.gmailFacts(account)
        : undefined;

    await this.upsertMap(
      userId,
      { type: DocLinkType.APP, targetId: account.id, label },
      `Mapa – ${label}`,
      gmail
        ? `A conta ${account.emailAddress ?? label}: regras, marcadores e a caixa. Gerado pelo MyHomeLab; as Notas são tuas (para que serve a conta, o que lá vai parar).`
        : `A app ${label}: endereço, versão e onde corre. Gerado pelo MyHomeLab; as Notas são tuas.`,
      [app.toLowerCase()],
      (title, existing) =>
        appMap(
          title,
          {
            app,
            baseUrl: account.baseUrl,
            username: account.username,
            emailAddress: account.emailAddress,
            isAdmin: account.isAdmin,
            version: account.appVersion,
            latestVersion: account.appLatestVersion,
            checkedAt: account.appCheckedAt,
            runsOn,
            since: account.createdAt,
            gmail,
          },
          existing,
        ),
    );
  }

  /** Cria o mapa, ou reescreve-o mantendo o título (se o mudaram) e as Notas. */
  private async upsertMap(
    userId: string,
    link: { type: DocLinkType; targetId: string; label: string },
    title: string,
    summary: string,
    tags: string[],
    build: (title: string, existing?: string | null) => string,
  ) {
    const existing = await this.prisma.doc.findFirst({
      where: {
        userId,
        tags: { has: MAP_TAG },
        links: { some: { type: link.type, targetId: link.targetId } },
      },
    });

    if (existing) {
      const content = build(existing.title, existing.content);
      // Sem versão guardada: o gerado refaz-se sempre igual, e as Notas não mudam aqui.
      if (content !== existing.content) {
        await this.prisma.doc.update({
          where: { id: existing.id },
          data: { content, updatedBy: AUTHOR },
        });
      }
      await this.prisma.docLink.updateMany({
        where: { docId: existing.id, type: link.type, targetId: link.targetId },
        data: { label: link.label },
      });
      return;
    }

    await this.prisma.doc.create({
      data: {
        userId,
        title,
        kind: DocKind.MAP,
        owner: DocOwner.AGENT,
        content: build(title),
        summary,
        tags: ['mapa', MAP_TAG, ...tags],
        updatedBy: AUTHOR,
        links: { create: [link] },
      },
    });
  }
}
