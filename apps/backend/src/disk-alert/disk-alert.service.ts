import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BoardService } from 'src/board/board.service';
import { NotificationService } from 'src/notification/notification.service';
import { ServerConnectionService } from 'src/server-connection/server-connection.service';
import {
  AgentScheduleRepeat,
  DiskAlert,
  DiskAlertStatus,
  DocLinkType,
  NotificationKind,
  ProjectKind,
} from 'src/generated/prisma/client/client';
import {
  ProxmoxClient,
  ProxmoxGuestRef,
  createProxmoxClient,
} from 'src/proxmox/proxmox.client';
import { isInstallApproval } from 'src/board/helpers/isInstallApproval';
import { DiskAlertOptions, diskAlertOptions } from './disk-alert.options';
import { GuestDisk, measureGuestDisks } from './helpers/measureGuestDisks';

const GIB = 1024 ** 3;
/** Depois de fechar, o agente só volta a pegar no mesmo disco passadas 6 horas. */
const COOLDOWN_MS = 6 * 60 * 60_000;
/** Uma medição nova só fica comentada na tarefa se mudou pelo menos isto. */
const COMMENT_STEP = 1;
const ACTOR = 'MyHomeLab';
export const DISK_ALERT_JOB = 'proxmox.disk_alert';

const OPEN: DiskAlertStatus[] = [
  DiskAlertStatus.OPEN,
  DiskAlertStatus.STUDY,
  DiskAlertStatus.WAITING,
  DiskAlertStatus.FIXING,
  DiskAlertStatus.VERIFYING,
];

/** A coluna do quadro (projeto do servidor) de cada estado. */
const COLUMN: Record<DiskAlertStatus, string> = {
  OPEN: 'new',
  STUDY: 'studying',
  WAITING: 'waiting',
  FIXING: 'in_progress',
  VERIFYING: 'verifying',
  DONE: 'done',
  CANCELLED: 'cancelled',
};

const gb = (bytes: number) =>
  `${(bytes / GIB).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} GB`;

const guestLabel = (
  alert: Pick<DiskAlert, 'guestKind' | 'vmid' | 'guestName'>,
) =>
  `${alert.guestKind === 'lxc' ? 'CT' : 'VM'} ${alert.vmid} (${alert.guestName})`;

const diskLabel = (target: string) =>
  target === 'rootfs' ? 'o disco' : `o disco ${target}`;

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export interface DiskCheckResult {
  count: number;
  detail: {
    over: { label: string; percent: number }[];
    noAgent: { vmid: number; name: string }[];
  };
}

export type StudyAction = 'cleanup' | 'grow' | 'ask';

/** A ação que o agente escolheu no estudo (outra → 400). */
export function studyAction(value: string): StudyAction {
  if (value === 'cleanup' || value === 'grow' || value === 'ask') return value;
  throw new BadRequestException('A ação tem de ser cleanup, grow ou ask.');
}

/**
 * O aviso de disco quase cheio dos servidores Proxmox. O caminho é todo daqui: a medição
 * (cron job, sem IA), a tarefa no quadro do servidor e as colunas, as notificações, chamar
 * o agente e os travões do que ele pode fazer. O agente só estuda e corrige, pelas
 * ferramentas disk_alert_* — e cada uma passa por aqui.
 */
@Injectable()
export class DiskAlertService implements OnModuleInit {
  private readonly logger = new Logger(DiskAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly board: BoardService,
    private readonly notifications: NotificationService,
    private readonly servers: ServerConnectionService,
  ) {}

  onModuleInit() {
    this.board.onStateChange((change) => this.onBoardMove(change));
  }

  // ── A medição (o cron job) ─────────────────────────────────────────────

  async check(
    userId: string,
    serverId: string,
    options: DiskAlertOptions,
  ): Promise<DiskCheckResult> {
    const conn = await this.servers.connectionById(serverId);
    if (!conn) throw new NotFoundException('Esse servidor já não existe.');
    const client = createProxmoxClient(conn);
    const reading = await measureGuestDisks(client, options.guests);
    const over = reading.disks.filter(
      (disk) => disk.percent >= options.thresholdPercent,
    );
    const open = await this.prisma.diskAlert.findMany({
      where: { serverConnectionId: serverId, status: { in: OPEN } },
    });
    const same = (alert: DiskAlert, disk: GuestDisk) =>
      alert.vmid === disk.vmid && alert.target === disk.target;

    for (const disk of over) {
      const existing = open.find((alert) => same(alert, disk));
      if (existing) await this.remeasure(existing, disk, options);
      else await this.openAlert(userId, serverId, conn.name, disk, options);
    }
    // Os que baixaram por outro motivo (ex.: ele limpou) fecham-se sozinhos; os que o
    // agente está a corrigir ficam para o disk_alert_done.
    for (const alert of open) {
      const disk = reading.disks.find((entry) => same(alert, entry));
      if (
        !disk ||
        disk.percent >= options.thresholdPercent ||
        alert.status === DiskAlertStatus.FIXING
      )
        continue;
      await this.close(
        alert,
        DiskAlertStatus.DONE,
        `✅ Baixou para ${disk.percent}% (abaixo de ${options.thresholdPercent}%): fechada.`,
        disk,
      );
    }
    return {
      count: over.length,
      detail: {
        over: over.map((disk) => ({
          label:
            `${disk.kind === 'lxc' ? 'CT' : 'VM'} ${disk.vmid} ${disk.target === 'rootfs' ? '' : disk.target}`.trim(),
          percent: disk.percent,
        })),
        noAgent: reading.noAgent,
      },
    };
  }

  private async openAlert(
    userId: string,
    serverId: string,
    serverName: string,
    disk: GuestDisk,
    options: DiskAlertOptions,
  ) {
    const agentKey = options.agent
      ? await this.agentFor(userId, options)
      : null;
    const recent = await this.prisma.diskAlert.findFirst({
      where: {
        serverConnectionId: serverId,
        vmid: disk.vmid,
        target: disk.target,
        closedAt: { gt: new Date(Date.now() - COOLDOWN_MS) },
      },
    });
    const alert = await this.prisma.diskAlert.create({
      data: {
        userId,
        serverConnectionId: serverId,
        node: disk.node,
        guestKind: disk.kind,
        vmid: disk.vmid,
        guestName: disk.name,
        target: disk.target,
        usedBytes: disk.usedBytes,
        totalBytes: disk.totalBytes,
        firstPercent: disk.percent,
        percent: disk.percent,
        agentKey,
        measuredAt: new Date(),
      },
    });
    const label = guestLabel(alert);
    const title = `Disco quase cheio: ${label}${disk.target === 'rootfs' ? '' : ` ${disk.target}`} a ${disk.percent}%`;
    const project = await this.projectFor(userId, serverId);
    const task = await this.board.createTask(
      userId,
      {
        projectId: project.id,
        title: title.slice(0, 200),
        description: [
          `**Aviso de disco ${alert.id}** — ${serverName}, nó ${disk.node}.`,
          '',
          `${label}: ${diskLabel(disk.target)} está a **${disk.percent}%** (${gb(disk.usedBytes)} de ${gb(disk.totalBytes)}); o limite é ${options.thresholdPercent}%.`,
          '',
          options.agent
            ? `O agente estuda o que ocupa o espaço e corrige pelas ferramentas disk_alert_* (disk_alert_get ${alert.id}). Sem te perguntar só limpa o que é seguro e aumenta um CT até ${options.maxDiskGb} GB, ${options.stepGb} GB de cada vez, deixando pelo menos ${options.minStorageFreeGb} GB livres no storage.`
            : 'O agente não está ligado neste aviso: fica como registo até baixar do limite.',
        ].join('\n'),
        stateKey: COLUMN.OPEN,
        priority: 'HIGH',
        assignee: agentKey,
        labels: ['disco'],
      },
      ACTOR,
    );
    await this.prisma.diskAlert.update({
      where: { id: alert.id },
      data: { boardTaskId: task.id },
    });
    const fresh = { ...alert, boardTaskId: task.id };
    if (options.notify) await this.notify(fresh, serverName, options);
    if (!options.agent) return;
    if (!agentKey) {
      await this.board.comment(
        userId,
        task.id,
        '⚠ Nenhum agente ativo tem as ferramentas disk_alert_* (Assistente → Workflow): fica à espera de ti.',
        ACTOR,
      );
      return;
    }
    if (recent) {
      await this.ask(
        fresh,
        `O disco voltou a passar o limite menos de 6 horas depois do último aviso (${recent.firstPercent}% → fechado). Não volto a mexer sozinho: queres que o agente estude outra vez (passa para In progress) ou deixamos (Cancelled)?`,
      );
      return;
    }
    await this.startStudy(fresh, options);
  }

  private async remeasure(
    alert: DiskAlert,
    disk: GuestDisk,
    options: DiskAlertOptions,
  ) {
    await this.prisma.diskAlert.update({
      where: { id: alert.id },
      data: {
        usedBytes: disk.usedBytes,
        totalBytes: disk.totalBytes,
        percent: disk.percent,
        measuredAt: new Date(),
      },
    });
    if (
      alert.boardTaskId &&
      Math.abs(disk.percent - alert.percent) >= COMMENT_STEP
    ) {
      await this.board
        .comment(
          alert.userId,
          alert.boardTaskId,
          `📈 Nova medição: ${disk.percent}% (${gb(disk.usedBytes)} de ${gb(disk.totalBytes)}).`,
          ACTOR,
        )
        .catch(() => undefined);
    }
    if (options.notify) {
      const server = await this.prisma.serverConnection.findUnique({
        where: { id: alert.serverConnectionId },
        select: { name: true },
      });
      await this.notify(
        {
          ...alert,
          percent: disk.percent,
          usedBytes: disk.usedBytes,
          totalBytes: disk.totalBytes,
        },
        server?.name ?? '',
        options,
      );
    }
  }

  // ── O agente ───────────────────────────────────────────────────────────

  /**
   * O agente escolhido no cron job; sem escolha, o primeiro ativo com as ferramentas que
   * também corre comandos por SSH (pode ver o que ocupa o espaço e limpar), senão qualquer um.
   */
  private async agentFor(userId: string, options: DiskAlertOptions) {
    const agents = await this.prisma.agent.findMany({
      where: {
        userId,
        isActive: true,
        tools: { has: 'disk_alert_save_study' },
        ...(options.agentKey ? { key: options.agentKey } : {}),
      },
      orderBy: { createdAt: 'asc' },
      select: { key: true, tools: true },
    });
    const withShell = agents.find((agent) =>
      agent.tools.includes('server_run_command'),
    );
    return (withShell ?? agents[0])?.key ?? null;
  }

  private async startStudy(alert: DiskAlert, options: DiskAlertOptions) {
    await this.move(alert, DiskAlertStatus.STUDY);
    await this.dispatch(
      alert,
      `Estudar o disco de ${guestLabel(alert)}`,
      `Aviso de disco ${alert.id}: ${guestLabel(alert)}, ${diskLabel(alert.target)} está a ${alert.percent}% (limite ${options.thresholdPercent}%). ` +
        'Estuda e corrige, seguindo os documentos:\n' +
        `1. disk_alert_get ${alert.id} (a medição, os limites e o storage);\n` +
        '2. vê o que ocupa o espaço (por SSH com server_run_command, se o tiveres), sem mudar nada;\n' +
        '3. grava o diagnóstico e o plano com disk_alert_save_study, com a ação: cleanup (limpar o que é seguro), grow (aumentar o disco, com quantos GB) ou ask (precisas dele);\n' +
        '4. se o MyHomeLab disser que podes avançar, faz (limpar por SSH ou disk_alert_grow) e acaba com disk_alert_done; se disser que tem de perguntar, a pergunta já ficou na tarefa.',
    );
  }

  /** Chama o agente da tarefa (um disparo para agora, ligado à tarefa). */
  private async dispatch(alert: DiskAlert, title: string, instruction: string) {
    if (!alert.agentKey) return;
    const task = alert.boardTaskId
      ? await this.prisma.boardTask.findUnique({
          where: { id: alert.boardTaskId },
          select: { title: true },
        })
      : null;
    await this.prisma.agentSchedule.create({
      data: {
        userId: alert.userId,
        agentKey: alert.agentKey,
        title: title.slice(0, 120),
        instruction,
        repeat: AgentScheduleRepeat.ONCE,
        runAt: new Date(),
        nextRunAt: new Date(),
        notify: false,
        createdBy: ACTOR,
        tags: ['disco'],
        ...(alert.boardTaskId
          ? {
              linkType: DocLinkType.TASK,
              targetId: alert.boardTaskId,
              targetLabel: (task?.title ?? title).slice(0, 200),
            }
          : {}),
      },
    });
  }

  // ── As ferramentas do agente ───────────────────────────────────────────

  private async owned(userId: string, id: string) {
    const alert = await this.prisma.diskAlert.findFirst({
      where: { id, userId },
    });
    if (!alert)
      throw new NotFoundException(`Não há nenhum aviso de disco ${id}.`);
    return alert;
  }

  private async optionsOf(alert: DiskAlert): Promise<DiskAlertOptions> {
    const job = await this.prisma.cronJob.findUnique({
      where: {
        serverConnectionId_key: {
          serverConnectionId: alert.serverConnectionId,
          key: DISK_ALERT_JOB,
        },
      },
    });
    return diskAlertOptions(job?.options, false);
  }

  private async clientOf(alert: DiskAlert): Promise<ProxmoxClient> {
    const conn = await this.servers.connectionById(alert.serverConnectionId);
    if (!conn) throw new NotFoundException('Esse servidor já não existe.');
    return createProxmoxClient(conn);
  }

  private refOf(alert: DiskAlert): ProxmoxGuestRef {
    return {
      node: alert.node,
      kind: alert.guestKind === 'lxc' ? 'lxc' : 'qemu',
      guest: { vmid: alert.vmid, name: alert.guestName, status: 'running' },
    };
  }

  /** O storage do disco de um CT (rootfs) e quanto tem livre. */
  private async storageOf(alert: DiskAlert, client: ProxmoxClient) {
    if (alert.guestKind !== 'lxc') return null;
    const config = await client.guestConfig(this.refOf(alert));
    const rootfs = typeof config.rootfs === 'string' ? config.rootfs : '';
    const storage = rootfs.split(':')[0];
    if (!storage) return null;
    const resource = (await client.clusterResources()).find(
      (entry) =>
        entry.type === 'storage' &&
        entry.storage === storage &&
        entry.node === alert.node,
    );
    return {
      storage,
      freeBytes: Math.max(0, (resource?.maxdisk ?? 0) - (resource?.disk ?? 0)),
    };
  }

  /** Ele aprovou: passou a tarefa para In progress, ou respondeu "sim" depois da pergunta. */
  private async approvedNow(alert: DiskAlert) {
    if (alert.approved) return true;
    if (!alert.boardTaskId || !alert.askedAt) return false;
    const replies = await this.prisma.boardTaskComment.findMany({
      where: {
        taskId: alert.boardTaskId,
        author: 'user',
        createdAt: { gt: alert.askedAt },
      },
      select: { body: true },
    });
    return replies.some((reply) => isInstallApproval(reply.body));
  }

  async describe(userId: string, id: string): Promise<string> {
    const alert = await this.owned(userId, id);
    const options = await this.optionsOf(alert);
    const client = await this.clientOf(alert);
    const storage = await this.storageOf(alert, client).catch(() => null);
    const approved = await this.approvedNow(alert);
    return [
      `Aviso de disco ${alert.id} — ${guestLabel(alert)}, nó ${alert.node}, ${diskLabel(alert.target)}.`,
      `Estado: ${alert.status}. Medido a ${alert.measuredAt.toISOString()}: ${alert.percent}% (${gb(alert.usedBytes)} de ${gb(alert.totalBytes)}); abriu com ${alert.firstPercent}%. Limite: ${options.thresholdPercent}%.`,
      storage
        ? `Storage do disco: ${storage.storage}, ${gb(storage.freeBytes)} livres.`
        : alert.guestKind === 'qemu'
          ? 'É uma VM: aumentar o disco precisa do sim dele e de alargar a partição lá dentro (growpart e resize2fs, por SSH).'
          : 'Não consegui ler o storage do disco.',
      `Sem perguntar podes: limpar o que é seguro (cache do apt, journal antigo, pacotes órfãos, ficheiros temporários) e, num CT, aumentar até ${options.maxDiskGb ?? '?'} GB, ${options.stepGb ?? '?'} GB de cada vez, deixando pelo menos ${options.minStorageFreeGb ?? '?'} GB livres no storage.`,
      approved
        ? 'Ele já aprovou o plano: podes ir além dos limites automáticos (o espaço livre mínimo do storage fica sempre).'
        : 'Ele ainda não aprovou nada além disso.',
      alert.study ? `Estudo gravado:\n${alert.study}` : 'Ainda sem estudo.',
      alert.question ? `Pergunta em aberto: ${alert.question}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  /** Quanto falta para um aumento caber nos travões; null = cabe. */
  private async growBlock(
    alert: DiskAlert,
    growGb: number,
    options: DiskAlertOptions,
    approved: boolean,
  ): Promise<string | null> {
    if (!Number.isFinite(growGb) || growGb <= 0)
      return 'diz quantos GB aumentar';
    if (alert.guestKind !== 'lxc' && !approved)
      return 'numa VM o aumento precisa sempre do teu sim (e de alargar a partição lá dentro)';
    const newTotalGb = alert.totalBytes / GIB + growGb;
    if (!approved && options.stepGb && growGb > options.stepGb)
      return `${growGb} GB é mais do que os ${options.stepGb} GB de cada vez`;
    if (!approved && options.maxDiskGb && newTotalGb > options.maxDiskGb)
      return `o disco ficava com ${Math.round(newTotalGb)} GB, acima do máximo de ${options.maxDiskGb} GB`;
    const client = await this.clientOf(alert);
    const storage = await this.storageOf(alert, client).catch(() => null);
    if (alert.guestKind === 'lxc' && !storage)
      return 'não consegui ler o espaço livre do storage';
    if (storage && options.minStorageFreeGb) {
      const freeAfter = storage.freeBytes / GIB - growGb;
      if (freeAfter < options.minStorageFreeGb)
        return `o storage ${storage.storage} ficava com ${Math.max(0, Math.round(freeAfter))} GB livres, abaixo do mínimo de ${options.minStorageFreeGb} GB`;
    }
    return null;
  }

  async saveStudy(
    userId: string,
    id: string,
    input: {
      diagnosis: string;
      plan: string;
      action: StudyAction;
      growGb?: number;
      question?: string;
    },
  ): Promise<string> {
    const alert = await this.owned(userId, id);
    const studyable: DiskAlertStatus[] = [
      DiskAlertStatus.OPEN,
      DiskAlertStatus.STUDY,
      DiskAlertStatus.WAITING,
    ];
    if (!studyable.includes(alert.status)) {
      return `Este aviso está em ${alert.status}: o estudo já não se grava.`;
    }
    const study =
      `**Diagnóstico:** ${input.diagnosis.trim()}\n\n**Plano:** ${input.plan.trim()}`.slice(
        0,
        6000,
      );
    await this.prisma.diskAlert.update({ where: { id }, data: { study } });
    if (alert.boardTaskId) {
      await this.board.comment(
        userId,
        alert.boardTaskId,
        `🔎 ${study}`,
        alert.agentKey ?? ACTOR,
      );
    }
    const options = await this.optionsOf(alert);
    const approved = await this.approvedNow(alert);
    const fresh = { ...alert, study };
    if (input.action === 'ask') {
      const question = input.question?.trim();
      if (!question) return 'Com a ação ask, escreve a pergunta (question).';
      await this.ask(fresh, question);
      return 'Ficou em Waiting for reply com a tua pergunta. Pára aqui: quando ele responder, és chamado outra vez.';
    }
    if (input.action === 'grow') {
      const block = await this.growBlock(
        fresh,
        input.growGb ?? 0,
        options,
        approved,
      );
      if (block) {
        await this.ask(
          fresh,
          `${input.plan.trim()}\n\nPreciso do teu sim porque ${block}. Responde "sim" (ou passa a tarefa para In progress) para avançar, ou diz o que preferes.`,
        );
        return `Não cabe no que podes fazer sozinho (${block}): ficou em Waiting for reply com a pergunta. Pára aqui.`;
      }
      await this.move(fresh, DiskAlertStatus.FIXING, { approved });
      return `Podes avançar: aumenta com disk_alert_grow (${input.growGb} GB) e, se for preciso, alarga o sistema de ficheiros. No fim, disk_alert_done com o que fizeste.`;
    }
    await this.move(fresh, DiskAlertStatus.FIXING, { approved });
    return 'Podes limpar o que é seguro (segue os documentos; nada que seja dele sem perguntar). No fim, disk_alert_done com o que fizeste e quanto libertaste.';
  }

  async grow(
    userId: string,
    id: string,
    growGb: number,
    disk?: string,
  ): Promise<string> {
    const alert = await this.owned(userId, id);
    if (alert.status !== DiskAlertStatus.FIXING) {
      return `Este aviso está em ${alert.status}: grava primeiro o estudo (disk_alert_save_study) para o MyHomeLab dizer se podes.`;
    }
    const options = await this.optionsOf(alert);
    const approved = await this.approvedNow(alert);
    const block = await this.growBlock(alert, growGb, options, approved);
    if (block) {
      await this.ask(
        alert,
        `Para aumentar ${growGb} GB preciso do teu sim: ${block}.`,
      );
      return `Recusado (${block}): ficou em Waiting for reply com a pergunta.`;
    }
    const target = alert.guestKind === 'lxc' ? 'rootfs' : disk?.trim();
    if (!target)
      return 'Numa VM diz o disco virtual a aumentar (disk, ex.: scsi0).';
    const client = await this.clientOf(alert);
    const ref = this.refOf(alert);
    try {
      const upid = await client.resizeDisk(ref, target, `+${growGb}G`);
      const status =
        typeof upid === 'string'
          ? await client.waitTask(alert.node, upid)
          : 'OK';
      if (status !== 'OK') throw new Error(status);
    } catch (error) {
      return `O Proxmox não aumentou o disco: ${errorText(error)}`;
    }
    const totalBytes = alert.totalBytes + growGb * GIB;
    await this.prisma.diskAlert.update({
      where: { id },
      data: { totalBytes },
    });
    if (alert.boardTaskId) {
      await this.board.comment(
        userId,
        alert.boardTaskId,
        `💽 ${target} de ${guestLabel(alert)} aumentado em ${growGb} GB (agora ${gb(totalBytes)}).`,
        alert.agentKey ?? ACTOR,
      );
    }
    return alert.guestKind === 'lxc'
      ? `Aumentado: ${target} +${growGb} GB (o CT vê logo o espaço novo). Acaba com disk_alert_done.`
      : `Aumentado o disco virtual ${target} +${growGb} GB. Falta alargar a partição e o sistema de ficheiros na VM (growpart e resize2fs, por SSH); depois disk_alert_done.`;
  }

  async askUser(userId: string, id: string, question: string): Promise<string> {
    const alert = await this.owned(userId, id);
    if (!OPEN.includes(alert.status))
      return `Este aviso já está em ${alert.status}.`;
    if (!question.trim()) return 'Escreve a pergunta.';
    await this.ask(alert, question.trim());
    return 'Ficou em Waiting for reply com a pergunta. Pára aqui: quando ele responder, és chamado outra vez.';
  }

  /** O agente acabou: o MyHomeLab volta a medir e fecha, ou pergunta o que fazer. */
  async done(userId: string, id: string, summary: string): Promise<string> {
    const alert = await this.owned(userId, id);
    if (!OPEN.includes(alert.status))
      return `Este aviso já está em ${alert.status}.`;
    await this.move(alert, DiskAlertStatus.VERIFYING);
    if (alert.boardTaskId) {
      await this.board.comment(
        userId,
        alert.boardTaskId,
        `🛠 ${summary.trim().slice(0, 4000)}`,
        alert.agentKey ?? ACTOR,
      );
    }
    const options = await this.optionsOf(alert);
    let disk: GuestDisk | undefined;
    try {
      const client = await this.clientOf(alert);
      const reading = await measureGuestDisks(client, [alert.vmid]);
      disk = reading.disks.find((entry) => entry.target === alert.target);
    } catch (error) {
      this.logger.warn(`Medir o disco ${alert.id}: ${errorText(error)}`);
    }
    if (!disk) {
      await this.ask(
        alert,
        'Não consegui voltar a medir o disco (a máquina está ligada?). Confirma tu e diz-me se fecho a tarefa.',
      );
      return 'Não consegui voltar a medir: ficou em Waiting for reply.';
    }
    if (disk.percent < options.thresholdPercent) {
      await this.close(
        alert,
        DiskAlertStatus.DONE,
        `✅ Verificado: ${alert.firstPercent}% → ${disk.percent}% (${gb(disk.usedBytes)} de ${gb(disk.totalBytes)}).`,
        disk,
      );
      return `Verificado e fechado: ${alert.firstPercent}% → ${disk.percent}%.`;
    }
    await this.prisma.diskAlert.update({
      where: { id },
      data: {
        percent: disk.percent,
        usedBytes: disk.usedBytes,
        totalBytes: disk.totalBytes,
        measuredAt: new Date(),
      },
    });
    await this.ask(
      alert,
      `Depois do que fiz, o disco continua a ${disk.percent}% (limite ${options.thresholdPercent}%). O que fazemos?`,
    );
    return `Continua a ${disk.percent}%: ficou em Waiting for reply com a pergunta.`;
  }

  // ── O quadro ───────────────────────────────────────────────────────────

  /** O projeto do servidor (o das atualizações ligado a ele; senão o das atualizações). */
  private async projectFor(userId: string, serverId: string) {
    const linked = await this.prisma.project.findFirst({
      where: {
        userId,
        kind: ProjectKind.UPDATES,
        serverConnectionId: serverId,
      },
      select: { id: true },
    });
    return linked ?? (await this.board.ensureUpdatesProject(userId));
  }

  private async move(
    alert: DiskAlert,
    status: DiskAlertStatus,
    extra: { approved?: boolean } = {},
  ) {
    await this.prisma.diskAlert.update({
      where: { id: alert.id },
      data: {
        status,
        ...(extra.approved !== undefined ? { approved: extra.approved } : {}),
        ...(status === DiskAlertStatus.WAITING ? {} : { question: null }),
      },
    });
    if (alert.boardTaskId) {
      await this.board
        .updateTask(
          alert.userId,
          alert.boardTaskId,
          { stateKey: COLUMN[status] },
          ACTOR,
        )
        .catch((error: unknown) =>
          this.logger.warn(
            `Mover a tarefa do aviso ${alert.id}: ${errorText(error)}`,
          ),
        );
    }
  }

  private async ask(alert: DiskAlert, question: string) {
    await this.move(alert, DiskAlertStatus.WAITING);
    await this.prisma.diskAlert.update({
      where: { id: alert.id },
      data: { question: question.slice(0, 4000), askedAt: new Date() },
    });
    if (alert.boardTaskId) {
      await this.board
        .askUser(
          alert.userId,
          alert.boardTaskId,
          question.slice(0, 4000),
          alert.agentKey ?? ACTOR,
        )
        .catch((error: unknown) =>
          this.logger.warn(
            `Perguntar no aviso ${alert.id}: ${errorText(error)}`,
          ),
        );
    }
  }

  private async close(
    alert: DiskAlert,
    status: DiskAlertStatus,
    note: string,
    disk?: GuestDisk,
  ) {
    await this.prisma.diskAlert.update({
      where: { id: alert.id },
      data: {
        closedAt: new Date(),
        ...(disk
          ? {
              percent: disk.percent,
              usedBytes: disk.usedBytes,
              totalBytes: disk.totalBytes,
              measuredAt: new Date(),
            }
          : {}),
      },
    });
    if (alert.boardTaskId) {
      await this.board
        .comment(alert.userId, alert.boardTaskId, note, ACTOR)
        .catch(() => undefined);
    }
    await this.move(alert, status);
    await this.notifications.resolveUserSubject(
      alert.userId,
      this.subjectOf(alert),
      NotificationKind.DISK_WARNING,
    );
  }

  private subjectOf(
    alert: Pick<DiskAlert, 'serverConnectionId' | 'vmid' | 'target'>,
  ) {
    return `disk-alert:${alert.serverConnectionId}:${alert.vmid}:${alert.target}`;
  }

  private async notify(
    alert: DiskAlert,
    serverName: string,
    options: DiskAlertOptions,
  ) {
    await this.notifications.openUserSubject({
      userId: alert.userId,
      subject: this.subjectOf(alert),
      serverConnectionId: alert.serverConnectionId,
      kind: NotificationKind.DISK_WARNING,
      title: `${serverName}: disco quase cheio em ${guestLabel(alert)}`,
      message: `${diskLabel(alert.target)} está a ${alert.percent}% (${gb(alert.usedBytes)} de ${gb(alert.totalBytes)}; limite ${options.thresholdPercent}%).${options.agent ? ' O agente está a tratar disto no quadro do servidor.' : ''}`,
    });
  }

  /** Ele mexeu na tarefa à mão: In progress aprova, Done e Cancelled fecham. */
  private async onBoardMove(change: {
    taskId: string;
    toKey: string | null;
    actor: string;
  }) {
    if (change.actor !== 'user' || !change.toKey) return;
    const alert = await this.prisma.diskAlert.findFirst({
      where: { boardTaskId: change.taskId, status: { in: OPEN } },
    });
    if (!alert) return;
    if (change.toKey === COLUMN.CANCELLED || change.toKey === COLUMN.DONE) {
      await this.prisma.diskAlert.update({
        where: { id: alert.id },
        data: {
          status:
            change.toKey === COLUMN.DONE
              ? DiskAlertStatus.DONE
              : DiskAlertStatus.CANCELLED,
          closedAt: new Date(),
          question: null,
        },
      });
      await this.notifications.resolveUserSubject(
        alert.userId,
        this.subjectOf(alert),
        NotificationKind.DISK_WARNING,
      );
      return;
    }
    if (change.toKey === COLUMN.FIXING) {
      await this.prisma.diskAlert.update({
        where: { id: alert.id },
        data: {
          status: DiskAlertStatus.FIXING,
          approved: true,
          question: null,
        },
      });
      await this.dispatch(
        alert,
        `Corrigir o disco de ${guestLabel(alert)}`,
        `Aviso de disco ${alert.id}: ele passou a tarefa para In progress — aprovou o teu plano. ` +
          `Lê com disk_alert_get ${alert.id} e com board_get a tarefa (o estudo e os comentários dele), faz o plano (limpar por SSH ou disk_alert_grow) e acaba com disk_alert_done.`,
      );
    }
  }
}
