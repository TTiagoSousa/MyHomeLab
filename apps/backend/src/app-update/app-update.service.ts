import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AppUpdate,
  AppUpdateStatus,
  ConnectedAccount,
  DocKind,
  NotificationKind,
  Prisma,
  ServerConnection,
  UpdateAttemptKind,
  UpdateCheckPhase,
} from 'src/generated/prisma/client/client';
import { DocsService, lisbonTime } from 'src/docs/docs.service';
import { ServerCommandService } from 'src/server-connection/server-command.service';
import {
  ServerConnectionService,
  toProxmoxConnection,
} from 'src/server-connection/server-connection.service';
import { createProxmoxClient } from 'src/proxmox/proxmox.client';
import { ServerUpdates } from 'src/server-connection/helpers/serverUpdates';
import { NotificationService } from 'src/notification/notification.service';
import { CheckState, UpdateAttemptService } from './update-attempt.service';
import { cleanVersion } from 'src/integrations/releases';
import { HaUpdateItem } from 'src/home-assistant/helpers/haUpdates';
import { normalizeText } from 'src/docs/helpers/docText';
import { BoardStatus } from './task-board/taskBoard';
import { BoardService, StateListener } from 'src/board/board.service';
import { readinessChecks } from './helpers/readinessChecks';
import {
  afterPoints,
  beforePoints,
  studyPoints,
  describeChecks,
  isMajorJump,
} from './helpers/updateChecks';
import { UpdateRecordService } from './update-record.service';
import { HaComponentsService } from './ha-components.service';
import { NextcloudAppsService } from './nextcloud-apps.service';
import { UpdateRunnerService } from './update-runner.service';
import {
  ACCOUNT_VIEW,
  ATTEMPT_LEGEND,
  FINISHED_OR_RUNNING,
  FROM_BOARD,
  HEADLINE_ICON,
  INSTALL_AGAIN_MS,
  PENDING_EVIDENCE,
  OPEN,
  PREPARED,
  RECHECK_MAX_DAYS,
  RISK,
  STATUS_NAMES,
  STUDY_SAVE_FROM,
  BOARD_STATUS,
  STUDY_RETRIES,
  STUDY_RETRY_DELAY_MS,
  HOST_VIEW,
  PVE_ROADMAP_URL,
  UPDATE_INCLUDE,
} from './app-update.constants';
import {
  PrepareInput,
  SaveUpdateSetting,
  StudyInput,
  UpdateWithAccount,
} from './app-update.types';
import { addDays, day, lisbon, now } from './helpers/updateDates';
import { installRequest } from './helpers/installRequest';
import {
  cleanList,
  howToUpdate,
  isAvailable,
  isHaComponent,
  isHostUpdate,
  plain,
  sourcesOf,
  targetLink,
  updateLabel,
} from './helpers/updateFields';
import { newerVersion } from './helpers/newerVersion';
import { verifyQuestion } from './helpers/verifyQuestion';
import { boardMoveAllowed } from './helpers/boardMoveAllowed';
import { agentChecks, checklistGaps, specDocsOf } from './helpers/checklist';
import { attemptChecks } from './helpers/attemptChecks';
import { codeChecks, commonChecks, hostChecks } from './helpers/measuredChecks';
import { findGuest } from './helpers/findGuest';
import { updateDocs } from './helpers/updateDocs';
import { specText } from './helpers/specText';
import { studyRequest } from './helpers/studyRequest';
import { nextcloudAppsBrief } from './helpers/nextcloudAppsBrief';
import { describeStatus } from './helpers/describeStatus';
import { INSTALL_RUNS, pausedInstall } from './helpers/installRetry';

/** O update_status espera por comandos a correr até este tempo, de tantos em tantos. */
const STATUS_WAIT_MS = 60_000;
const STATUS_POLL_MS = 5_000;
import { releaseNotes } from './helpers/releaseNotes';
import { knownIssues } from './helpers/knownIssues';
import { readSetting } from './helpers/readSetting';

/** Uma atualização do host a correr ou por verificar: a verificação dos servidores não lhe mexe. */
const HOST_BUSY: AppUpdateStatus[] = [
  AppUpdateStatus.IN_PROGRESS,
  AppUpdateStatus.VERIFYING,
];

export type {
  PrepareInput,
  SaveUpdateSetting,
  StudyInput,
} from './app-update.types';

/**
 * As atualizações das apps ligadas, de ponta a ponta: uma versão nova vira uma
 * tarefa em Projetos, no projeto do servidor (Todo), espera pelo estudo, o agente estuda-a
 * (Study → Estudo feito) e fica Ready to update, Waiting for reply ou Recheck
 * later. Quando o utilizador diz, o agente valida as regras com prova e o
 * MyHomeLab faz o snapshot, corre os comandos, confirma a versão nova e, se
 * falhar, volta ao snapshot. O código mede e regista; as regras estão nos
 * documentos.
 */
@Injectable()
export class AppUpdateService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(AppUpdateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly docs: DocsService,
    private readonly serverCommands: ServerCommandService,
    private readonly servers: ServerConnectionService,
    private readonly notifications: NotificationService,
    private readonly attempts: UpdateAttemptService,
    private readonly board: BoardService,
    private readonly record: UpdateRecordService,
    private readonly haComponents: HaComponentsService,
    private readonly nextcloudApps: NextcloudAppsService,
    private readonly runner: UpdateRunnerService,
  ) {}

  onModuleInit() {
    this.serverCommands.registerUpdateRunner((row) =>
      this.runner.runApproved(row),
    );
    this.board.onStateChange((change) => this.onBoardMove(change));
    this.servers.onUpdatesChecked((server, result) =>
      this.onServerUpdatesChecked(server, result),
    );
    this.docs.onChange((userId, doc) => this.onRulesChanged(userId, doc));
  }

  /**
   * Uma regra obrigatória mudou: as especificações feitas com as regras antigas
   * (preparadas e ainda por correr) ficam com o aviso no histórico, para o
   * agente preparar outra vez antes de correr.
   */
  private async onRulesChanged(
    userId: string,
    doc: { id: string; title: string; kind: DocKind },
  ) {
    if (doc.kind !== DocKind.RULES) return;
    const prepared = await this.prisma.appUpdate.findMany({
      where: { userId, status: { in: PREPARED }, spec: { not: null } },
    });
    for (const update of prepared) {
      await this.record.save(
        update,
        {},
        `📜 As regras mudaram ("${doc.title}") depois de a especificação ser escrita: prepara outra vez antes de correr.`,
      );
    }
  }

  /**
   * Ao arrancar: os estudos e verificações que ficaram a meio voltam à fila, e as
   * atualizações em aberto sem tarefa no quadro ganham uma. Em segundo plano.
   */
  onApplicationBootstrap() {
    void (async () => {
      const interrupted = await this.prisma.appUpdate.findMany({
        where: { status: AppUpdateStatus.STUDYING, studiedAt: null },
      });
      for (const update of interrupted) {
        await this.record.save(
          update,
          { status: AppUpdateStatus.STUDY, studyStartedAt: null },
          'O MyHomeLab reiniciou a meio do estudo: volta à espera de estudo.',
        );
      }
      // Uma instalação a meio quando o MyHomeLab reiniciou já não volta: fica em
      // Failed (com o aviso), senão bloqueava todas as instalações seguintes.
      const installing = await this.prisma.appUpdate.findMany({
        where: { status: AppUpdateStatus.IN_PROGRESS },
      });
      for (const update of installing) {
        await this.record.save(
          update,
          { status: AppUpdateStatus.FAILED, finishedAt: new Date() },
          `O MyHomeLab reiniciou a meio da instalação: confirma o estado da app${update.snapshotName ? ` (o snapshot antes de instalar é ${update.snapshotName})` : ''} e volta a pô-la em Ready to update quando quiseres tentar outra vez.`,
        );
      }
      await this.prisma.appUpdate.updateMany({
        where: {
          status: AppUpdateStatus.VERIFYING,
          afterChecks: { equals: Prisma.DbNull },
          verifyStartedAt: { not: null },
        },
        data: { verifyStartedAt: null },
      });
      const withoutTask = await this.prisma.appUpdate.findMany({
        where: { boardTaskId: null, status: { in: OPEN } },
      });
      for (const update of withoutTask) await this.record.save(update, {});
    })().catch((error: unknown) =>
      this.logger.warn(
        `Atualizações ao arrancar: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }

  // ── Definições ──────────────────────────────────────────────────────────

  getSetting(userId: string) {
    return readSetting(this.prisma, userId);
  }

  async saveSetting(userId: string, input: SaveUpdateSetting) {
    const data = {
      ...(input.boardModules
        ? {
            boardModules: [
              ...new Set(
                input.boardModules.map((name) => name.trim()).filter(Boolean),
              ),
            ].slice(0, 10),
          }
        : {}),
    };
    await this.prisma.updateWorkflowSetting.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return this.getSetting(userId);
  }

  // ── Ler ─────────────────────────────────────────────────────────────────

  list(userId: string) {
    return this.prisma.appUpdate.findMany({
      where: { userId },
      include: { account: ACCOUNT_VIEW, hostServer: HOST_VIEW },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
    });
  }

  async get(userId: string, id: string): Promise<UpdateWithAccount> {
    const update = await this.prisma.appUpdate.findFirst({
      where: { id, userId },
      include: UPDATE_INCLUDE,
    });
    if (!update) throw new NotFoundException('Atualização não encontrada');
    return plain(update);
  }

  /**
   * Uma atualização pelo que o agente escreve: o id, a tarefa do quadro
   * ("HOMELAB-12") ou o nome da app (a em aberto mais recente).
   */
  async findForAgent(
    userId: string,
    ref: string,
  ): Promise<UpdateWithAccount | string> {
    const needle = ref.trim();
    const direct = await this.prisma.appUpdate.findFirst({
      where: {
        userId,
        OR: [
          { id: needle },
          { boardTaskKey: { equals: needle, mode: 'insensitive' } },
        ],
      },
      include: UPDATE_INCLUDE,
    });
    if (direct) return plain(direct);
    const open = await this.prisma.appUpdate.findMany({
      where: { userId, status: { in: OPEN } },
      include: UPDATE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    const wanted = normalizeText(needle);
    const matches = open.filter((update) =>
      normalizeText(updateLabel(update)).includes(wanted),
    );
    if (matches.length === 1) return plain(matches[0]);
    if (!matches.length) {
      return `Não há nenhuma atualização em aberto de "${ref}". Vê as que há com updates_list.`;
    }
    return `"${ref}" pode ser: ${matches.map((update) => `${updateLabel(update)} ${update.toVersion} (${update.id})`).join(', ')}. Usa o id.`;
  }

  // ── Versões novas ───────────────────────────────────────────────────────

  /**
   * Chamado depois de se ver a versão de uma app: uma versão nova abre uma
   * atualização (e a tarefa no quadro); uma ainda mais nova antes de tratada
   * atualiza a mesma e volta ao estudo; se a app já estiver em dia (alguém a
   * atualizou à mão), a atualização em aberto fica feita.
   */
  async onVersionChecked(account: ConnectedAccount): Promise<void> {
    const open = await this.prisma.appUpdate.findFirst({
      where: { accountId: account.id, component: null, status: { in: OPEN } },
      orderBy: { createdAt: 'desc' },
    });
    if (!account.appLatestVersion) {
      if (
        open &&
        open.status !== AppUpdateStatus.IN_PROGRESS &&
        account.appVersion
      ) {
        const result = `A app já está na versão ${account.appVersion} (atualizada fora do MyHomeLab).`;
        await this.record.save(
          open,
          { status: AppUpdateStatus.DONE, result, finishedAt: now() },
          result,
        );
      }
      return;
    }
    const latest = cleanVersion(account.appLatestVersion);
    if (open) {
      if (
        cleanVersion(open.toVersion) === latest ||
        open.status === AppUpdateStatus.IN_PROGRESS
      ) {
        return;
      }
      const newer = newerVersion(open, latest);
      await this.record.save(
        open,
        { toVersion: latest, releaseUrl: account.appLatestUrl, ...newer.data },
        newer.text,
      );
      return;
    }
    // Uma versão já tratada (cancelada por ele, falhada, feita) não abre outra
    // tarefa; só uma versão mais nova volta a abrir.
    const handled = await this.prisma.appUpdate.findMany({
      where: { accountId: account.id, component: null },
      select: { toVersion: true },
    });
    if (handled.some((update) => cleanVersion(update.toVersion) === latest)) {
      return;
    }
    const created = await this.prisma.appUpdate.create({
      data: {
        userId: account.userId,
        accountId: account.id,
        fromVersion: account.appVersion ?? '?',
        toVersion: latest,
        releaseUrl: account.appLatestUrl,
      },
    });
    await this.record.save(
      created,
      {},
      `Saiu a versão ${latest} (está instalada a ${created.fromVersion}). Fica disponível (um agente abre-a quando a tratar).`,
    );
  }

  /**
   * Chamado depois de se ver as atualizações de um servidor (de 6 em 6 horas). No
   * host abre-se uma atualização de cada vez, como numa app (a tarefa no quadro e a
   * espera do estudo):
   * - uma versão nova do Proxmox VE (os pacotes do sistema vão juntos);
   * - sem versão nova, os pacotes do sistema por atualizar (`hostPackages`).
   * Se já estiver em dia (atualizado à mão), a em aberto fica feita.
   */
  async onServerUpdatesChecked(
    server: ServerConnection,
    result: ServerUpdates,
  ): Promise<void> {
    // Sem a lista de todos os nós não se sabe o que há por atualizar.
    if (!result.nodes.length || result.nodes.some((node) => node.error)) return;
    let open = await this.prisma.appUpdate.findFirst({
      where: { hostServerId: server.id, status: { in: OPEN } },
      orderBy: { createdAt: 'desc' },
    });
    // A correr ou por verificar, não se mexe (perdia-se o estudo e a instalação).
    if (open && HOST_BUSY.includes(open.status)) return;
    if (result.pve) {
      await this.openHostVersion(server, result, open);
      return;
    }
    if (open && (open.hostPackages === null || !result.total)) {
      const done =
        open.hostPackages === null
          ? 'O Proxmox VE já está em dia (atualizado fora do MyHomeLab).'
          : 'Os pacotes do sistema já estão instalados (fora do MyHomeLab).';
      await this.record.save(
        open,
        { status: AppUpdateStatus.DONE, result: done, finishedAt: now() },
        done,
      );
      open = null;
    }
    if (!result.total) return;
    if (open) {
      if (open.hostPackages !== result.total) {
        await this.record.save(
          open,
          { hostPackages: result.total },
          `Há agora ${result.total} pacotes do sistema por atualizar (eram ${open.hostPackages}).`,
        );
      }
      return;
    }
    // Cancelada ou falhada por ele: só volta a abrir se aparecerem mais pacotes.
    const last = await this.prisma.appUpdate.findFirst({
      where: { hostServerId: server.id, hostPackages: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    if (
      last &&
      (
        [AppUpdateStatus.CANCELLED, AppUpdateStatus.FAILED] as AppUpdateStatus[]
      ).includes(last.status) &&
      (last.hostPackages ?? 0) >= result.total
    ) {
      return;
    }
    const installed = await createProxmoxClient(toProxmoxConnection(server))
      .version()
      .then(({ version }) => cleanVersion(version))
      .catch(() => null);
    if (!installed) return;
    const created = await this.prisma.appUpdate.create({
      data: {
        userId: server.userId,
        hostServerId: server.id,
        serverConnectionId: server.id,
        fromVersion: installed,
        toVersion: installed,
        hostPackages: result.total,
      },
    });
    await this.record.save(
      created,
      {},
      `Há ${result.total} pacotes do sistema por atualizar no ${server.name}, sem versão nova do Proxmox VE (está na ${installed}). Fica disponível (um agente abre-a quando a tratar).`,
    );
  }

  /** Uma versão nova do Proxmox VE: abre-a, ou passa para ela a que está em aberto (dos pacotes ou de uma versão anterior). */
  private async openHostVersion(
    server: ServerConnection,
    result: ServerUpdates,
    open: AppUpdate | null,
  ): Promise<void> {
    const pve = result.pve!;
    const latest = cleanVersion(pve.to);
    if (open) {
      if (
        open.hostPackages === null &&
        cleanVersion(open.toVersion) === latest
      ) {
        return;
      }
      const newer = newerVersion(open, `${latest} do Proxmox VE`);
      await this.record.save(
        open,
        {
          fromVersion: cleanVersion(pve.from),
          toVersion: latest,
          hostPackages: null,
          releaseUrl: PVE_ROADMAP_URL,
          ...newer.data,
        },
        open.hostPackages === null
          ? newer.text
          : `${newer.text} Os pacotes do sistema vão juntos.`,
      );
      return;
    }
    const handled = await this.prisma.appUpdate.findMany({
      where: { hostServerId: server.id, hostPackages: null },
      select: { toVersion: true },
    });
    if (handled.some((update) => cleanVersion(update.toVersion) === latest)) {
      return;
    }
    const created = await this.prisma.appUpdate.create({
      data: {
        userId: server.userId,
        hostServerId: server.id,
        serverConnectionId: server.id,
        fromVersion: cleanVersion(pve.from),
        toVersion: latest,
        releaseUrl: PVE_ROADMAP_URL,
      },
    });
    await this.record.save(
      created,
      {},
      `Saiu a versão ${latest} do Proxmox VE (está instalada a ${created.fromVersion}; ${result.total} pacotes por atualizar). Fica disponível (um agente abre-a quando a tratar).`,
    );
  }

  // ── Estudo ──────────────────────────────────────────────────────────────

  /**
   * As que estão em Espera por estudo. Cada vez estuda-se uma vez: se falhar, fica
   * o erro e volta-se a pôr em Espera por estudo (assim um erro não se repete a pagar).
   */
  async pendingStudies() {
    return this.prisma.appUpdate.findMany({
      where: {
        status: AppUpdateStatus.STUDY,
        studiedAt: null,
        OR: [
          { studyStartedAt: null },
          // Um estudo que falhou volta a tentar sozinho uma vez, 3 horas depois da falha
          // (na falha, studyStartedAt passa a ser a hora da falha).
          {
            studyError: { not: null },
            studyRetries: { gt: 0, lte: STUDY_RETRIES },
            studyStartedAt: { lt: new Date(Date.now() - STUDY_RETRY_DELAY_MS) },
          },
        ],
      },
      include: UPDATE_INCLUDE,
      orderBy: { createdAt: 'asc' },
      take: 5,
    });
  }

  /**
   * As que se instalam agora: em Ready to update (foi ele que as pôs lá), a qualquer
   * hora. Uma de cada vez por utilizador: não há nenhuma a correr nem por verificar
   * (`busy` são os utilizadores com uma já pedida ao agente).
   */
  async pendingInstalls(busy: Set<string>) {
    const ready = await this.prisma.appUpdate.findMany({
      where: {
        status: AppUpdateStatus.READY,
        OR: [
          { installStartedAt: null },
          { installStartedAt: { lt: new Date(Date.now() - INSTALL_AGAIN_MS) } },
        ],
      },
      include: UPDATE_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    const picked: typeof ready = [];
    const seen = new Set(busy);
    for (const update of ready) {
      // Só ele a põe em Ready to update: isso é a autorização, e instala-se logo.
      if (seen.has(update.userId)) continue;
      seen.add(update.userId);
      const running = await this.prisma.appUpdate.count({
        where: {
          userId: update.userId,
          status: {
            in: [AppUpdateStatus.IN_PROGRESS, AppUpdateStatus.VERIFYING],
          },
        },
      });
      if (!running) picked.push(update);
    }
    return picked;
  }

  /** O pedido ao agente para a instalar (com o servidor do projeto, se tiver). */
  async installRequest(update: UpdateWithAccount): Promise<string> {
    const task = update.boardTaskId
      ? await this.prisma.boardTask.findUnique({
          where: { id: update.boardTaskId },
          select: {
            project: {
              select: { serverConnection: { select: { name: true } } },
            },
          },
        })
      : null;
    return installRequest(update, task?.project.serverConnection?.name ?? null);
  }

  async markInstall(id: string) {
    const update = await this.prisma.appUpdate.findUnique({ where: { id } });
    if (!update) return;
    await this.record.save(
      update,
      { installStartedAt: now() },
      '▶ Está em Ready to update: pedi ao agente para a instalar.',
    );
  }

  /** Depois de o agente acabar: se ficou em Ready to update, não avançou → Waiting for reply. */
  async afterInstall(id: string, reply: string, error?: string) {
    const update = await this.prisma.appUpdate.findUnique({ where: { id } });
    if (!update) return;
    const why = (error ?? reply).trim().slice(0, 600) || 'sem motivo';
    // Ficou parada depois de uma corrida que falhou e o agente não a resolveu.
    if (await pausedInstall(this.prisma, update)) {
      await this.record.save(
        update,
        { status: AppUpdateStatus.FAILED, finishedAt: now() },
        `❌ A instalação falhou e o agente acabou sem a resolver: ${why}`,
      );
      return;
    }
    if (update.status !== AppUpdateStatus.READY) return;
    // Uma peça do Home Assistant instala-se pelo próprio HA (ha_call_service): antes de
    // dizer que não avançou, vê-se já se a versão nova entrou (passa a Verifying).
    if (update.component && update.spec) {
      await this.haComponents.checkPreparedComponents().catch(() => undefined);
      const fresh = await this.prisma.appUpdate.findUnique({ where: { id } });
      if (fresh?.status !== AppUpdateStatus.READY) return;
    }
    await this.record.save(
      update,
      {
        status: AppUpdateStatus.WAITING,
        question: `A instalação não avançou: ${why}. Escolhe: Ready to update (tenta outra vez já), Recheck later ou Cancelled.`,
      },
      `⚠ A instalação não avançou: ${why}`,
    );
  }

  /** Depois de o agente acabar: se não gravou o estudo, fica o aviso. */
  async afterStudy(id: string, error?: string) {
    const update = await this.prisma.appUpdate.findUnique({ where: { id } });
    if (!update || update.studiedAt) return;
    await this.markStudy(
      id,
      false,
      error ?? 'O agente acabou sem gravar o estudo (update_save_study).',
    );
  }

  /** Começou (Study) ou acabou sem estudo gravado (volta à espera, com o erro). */
  async markStudy(id: string, started: boolean, error?: string) {
    const update = await this.prisma.appUpdate.findUnique({ where: { id } });
    if (!update) return;
    if (started) {
      // Mudada entretanto (ex.: no quadro): o estudo não lhe passa por cima.
      if (update.status !== AppUpdateStatus.STUDY) return;
      await this.record.save(
        update,
        {
          status: AppUpdateStatus.STUDYING,
          studyStartedAt: now(),
          studyError: null,
        },
        '🔎 O agente começou a estudar.',
      );
      return;
    }
    const retries = update.studyRetries + 1;
    const again = retries <= STUDY_RETRIES;
    await this.record.save(
      update,
      {
        status:
          update.status === AppUpdateStatus.STUDYING
            ? AppUpdateStatus.STUDY
            : update.status,
        studyError: error ?? null,
        studyRetries: retries,
        studyStartedAt: now(),
      },
      again
        ? `⚠ O estudo não ficou gravado: ${error ?? 'sem motivo'}. Volto a tentar sozinho daqui a 3 horas.`
        : `⚠ O estudo voltou a falhar: ${error ?? 'sem motivo'}. Para tentar outra vez, põe a tarefa em Espera por estudo.`,
    );
    if (!again) {
      const label = `${updateLabel(await this.prisma.appUpdate.findUniqueOrThrow({ where: { id: update.id }, include: UPDATE_INCLUDE }))} ${update.toVersion}`;
      await this.notifications
        .openUserSubject({
          userId: update.userId,
          subject: `update-study:${update.id}`,
          kind: NotificationKind.AGENT_NOTICE,
          title: `O estudo de ${label} falhou`,
          message: `Falhou duas vezes: ${error ?? 'sem motivo'}. Vê a tarefa em Projetos (o projeto do servidor) e põe-na em Espera por estudo para tentar outra vez.`,
        })
        .catch(() => undefined);
    }
  }

  async requestStudy(userId: string, id: string) {
    const update = await this.get(userId, id);
    if (update.status === AppUpdateStatus.IN_PROGRESS) {
      throw new BadRequestException('Esta atualização está a correr.');
    }
    return update;
  }

  /**
   * O pedido do estudo, com a tentativa de estudo: só os pontos das regras do estudo
   * (versão, notas, issues, idade), que o agente valida com update_check; os da
   * instalação entram na preparação. Fica guardada em Documentos → tentativas.
   */
  async studyBrief(update: UpdateWithAccount): Promise<string> {
    const docs = await updateDocs(this.docs, update, null, null);
    const attempt = await this.attempts.open(update, {
      title: `${updateLabel(update)} ${update.fromVersion} → ${update.toVersion}`,
      before: studyPoints(docs),
      after: [],
      measured: await commonChecks(this.prisma, update),
      docs: specDocsOf(docs),
      fresh: true,
      kind: UpdateAttemptKind.STUDY,
    });
    return (
      `${this.studyRequest(update)}${await nextcloudAppsBrief(update)}\n\n` +
      'TENTATIVA DE ESTUDO (as regras do estudo desta atualização): marca com update_check cada ponto (as notas lidas, quebras, a idade da versão, as issues), com a prova; os que precisam dele ficam por validar e vão na pergunta. Os pontos da instalação (a máquina, o snapshot, o backup recente) não entram aqui: vêm na preparação.\n' +
      `${ATTEMPT_LEGEND}\n${this.attempts.describe(attempt)}`
    );
  }

  /** O pedido que o agente recebe para estudar uma atualização. */
  studyRequest(update: UpdateWithAccount): string {
    return studyRequest(update);
  }

  // ── "Rever mais tarde" (os Agendamentos tratam da data) ────────────────

  /** As que estão em "Rever mais tarde" com data: cada uma tem um agendamento. */
  async laterWithDate() {
    const rows = await this.prisma.appUpdate.findMany({
      where: { status: AppUpdateStatus.LATER, recheckAt: { not: null } },
      include: UPDATE_INCLUDE,
    });
    return rows.map((update) => ({
      id: update.id,
      userId: update.userId,
      link: targetLink(update),
      label: `${updateLabel(update)} ${update.toVersion}`,
      recheckAt: update.recheckAt!,
    }));
  }

  /** Chegou o dia (o agendamento correu): volta ao estudo. Devolve-a pronta a estudar, ou null. */
  async recheckNow(id: string) {
    const update = await this.prisma.appUpdate.findUnique({ where: { id } });
    if (!update || update.status !== AppUpdateStatus.LATER) return null;
    await this.record.save(
      update,
      {
        status: AppUpdateStatus.STUDY,
        studyStartedAt: null,
        studiedAt: null,
        studyError: null,
        studyRetries: 0,
        recheckAt: null,
      },
      'Chegou o dia de voltar a ver: a atualização volta ao estudo.',
    );
    return update;
  }

  /** A que está em Espera por estudo (para o disparo "Estudar …"), ou null. */
  async studyQueued(id: string) {
    const update = await this.prisma.appUpdate.findUnique({ where: { id } });
    return update?.status === AppUpdateStatus.STUDY ? update : null;
  }

  /** A data mudada (ou tirada) na página Agendamentos. */
  async setRecheckDate(userId: string, id: string, date: Date | null) {
    const update = await this.get(userId, id);
    if (update.status !== AppUpdateStatus.LATER) return;
    if (update.recheckAt?.getTime() === date?.getTime()) return;
    await this.record.save(
      update,
      { recheckAt: date },
      date
        ? `🗓 Data para voltar a ver mudada nos Agendamentos: ${lisbonTime(date)}.`
        : '🗓 Tirada a data para voltar a ver (nos Agendamentos): fica em "Recheck later" até alguém decidir.',
    );
  }

  /** As notas entre a versão instalada e a nova. */
  releaseNotes(update: UpdateWithAccount): Promise<string> {
    return releaseNotes(update);
  }

  /** As issues abertas desde que a versão nova saiu. */
  knownIssues(update: UpdateWithAccount): Promise<string> {
    return knownIssues(update);
  }

  async saveStudy(
    update: UpdateWithAccount,
    input: StudyInput,
  ): Promise<string> {
    // Um estudo não passa por cima do que já se decidiu entretanto (cancelada, para mais
    // tarde, aprovada, a instalar ou já instalada).
    if (!STUDY_SAVE_FROM.includes(update.status)) {
      return `A atualização mudou para ${STATUS_NAMES[update.status]} enquanto estudavas: o estudo não foi gravado. Não mudes o estado; diz ao utilizador o que encontraste.`;
    }
    if (input.next === 'waiting' && !input.question?.trim()) {
      return 'Para pôr em Waiting tens de escrever a pergunta ao utilizador (question).';
    }
    if (!input.summary?.trim()) {
      return 'Falta o resumo em linguagem simples (summary): 2 a 4 frases para o utilizador perceber sem saber de informática.';
    }
    const days = Math.round(input.recheckInDays ?? 0);
    if (input.next === 'later' && (days < 1 || days > RECHECK_MAX_DAYS)) {
      return `Para "rever mais tarde" diz daqui a quantos dias (recheckInDays, de 1 a ${RECHECK_MAX_DAYS}).`;
    }
    const updateAfter = input.updateAfter
      ? new Date(`${input.updateAfter.slice(0, 10)}T09:00:00Z`)
      : null;
    if (updateAfter && Number.isNaN(updateAfter.getTime())) {
      return 'updateAfter tem de ser uma data AAAA-MM-DD.';
    }
    const sources = (input.sources ?? [])
      .filter((source) => /^https?:\/\//i.test(source.url ?? ''))
      .map((source) => ({
        title: (source.title || source.url).trim().slice(0, 200),
        url: source.url.trim(),
      }))
      .slice(0, 25);
    // Instala sozinho o que não é um salto major (e avisa no fim). Esperam pela decisão
    // dele: major, risco alto, passos à mão e, no host (sem snapshot), o que não é risco baixo.
    const manualAsked = isHostUpdate(update)
      ? []
      : cleanList(input.manualSteps);
    const blocked =
      input.next !== 'install'
        ? null
        : isMajorJump(update.fromVersion, update.toVersion)
          ? 'é um salto de versão major'
          : input.risk === 'high'
            ? 'o risco é alto'
            : isHostUpdate(update) && input.risk !== 'low'
              ? `é o host Proxmox (sem snapshot) e o risco é ${RISK[input.risk]}`
              : manualAsked.length
                ? 'tem passos à mão'
                : null;
    const autonomous = input.next === 'install' && !blocked;
    const recommended = input.next === 'todo' || Boolean(blocked);
    const question = recommended
      ? `Recomendo instalar ${updateLabel(update)} ${update.toVersion} (risco ${RISK[input.risk]}${blocked ? `; não instalo sozinho porque ${blocked}` : ''}): ${input.recommendation.trim()} ${updateAfter && updateAfter > now() ? `Se concordas, carrega em "Sim, instalar" a partir de ${day(updateAfter)}: se carregares antes, instala-se logo, antes dessa data.` : `Se concordas, carrega em "Sim, instalar" e instala-se logo.`} Senão, Mais tarde ou Cancelar.`
      : input.question?.trim();
    const status = autonomous
      ? AppUpdateStatus.READY
      : input.next === 'waiting' || recommended
        ? AppUpdateStatus.WAITING
        : AppUpdateStatus.LATER;
    const recheckAt =
      status === AppUpdateStatus.LATER ? addDays(now(), days) : null;
    // No host não há passos à mão: o que for preciso fica no estudo.
    const manualSteps = manualAsked;
    const newSteps = manualSteps.filter(
      (step) => !update.manualSteps.includes(step),
    );

    const saved = await this.record.save(
      update,
      {
        summary: input.summary.trim(),
        reasonsFor: cleanList(input.reasonsFor),
        reasonsAgainst: cleanList(input.reasonsAgainst),
        study: input.study,
        risk: input.risk,
        recommendation: input.recommendation,
        question: status === AppUpdateStatus.WAITING ? question! : null,
        manualSteps,
        updateAfter,
        recheckAt,
        sources: [
          ...new Map(
            [...sourcesOf(update), ...sources].map((source) => [
              source.url,
              source,
            ]),
          ).values(),
        ] as unknown as Prisma.InputJsonValue,
        status,
        studiedAt: now(),
        studyError: null,
        installStartedAt: null,
      },
      [
        `${HEADLINE_ICON[status]} **Estudo feito — risco ${RISK[input.risk]}.** ${input.recommendation}`,
        autonomous
          ? '▶ Não é um salto major e as regras passam: instalo-a já, segundo as regras (snapshot e backup antes), e aviso-te no fim.'
          : null,
        status === AppUpdateStatus.WAITING
          ? `❓ **Preciso de uma resposta:** ${question}`
          : null,
        recheckAt ? `⏸ Volto a ver a ${lisbonTime(recheckAt)}.` : null,
        input.summary.trim(),
      ]
        .filter(Boolean)
        .join('\n\n'),
      { links: true },
    );
    if (newSteps.length) await this.record.createStepTasks(saved, newSteps);
    await this.attempts.finishStudy(
      update.id,
      `Estudo feito — risco ${RISK[input.risk]}. ${input.recommendation}`,
    );

    const where =
      status === AppUpdateStatus.WAITING
        ? 'Waiting for reply (à espera da resposta do utilizador)'
        : status === AppUpdateStatus.LATER
          ? `Recheck later (volto a estudar a ${lisbonTime(recheckAt!)})`
          : 'Ready to update (instala-se já, pelo MyHomeLab)';
    return `Estudo gravado; a atualização ficou em ${where}.${blocked ? ` Não a instalas sozinho porque ${blocked}: fica a recomendação para ele decidir.` : ''} O relatório está no registo (Documentos)${saved.boardTaskKey ? ` e na tarefa ${saved.boardTaskKey}` : ''}.`;
  }

  async setStatus(
    update: UpdateWithAccount,
    status: 'ready' | 'todo' | 'waiting' | 'later' | 'cancelled',
    comment: string,
    recheckInDays?: number,
  ): Promise<string> {
    if (
      update.status === AppUpdateStatus.IN_PROGRESS &&
      !(await pausedInstall(this.prisma, update))
    ) {
      return 'Esta atualização está a correr; espera que acabe.';
    }
    const days = Math.round(recheckInDays ?? 0);
    if (status === 'later' && (days < 1 || days > RECHECK_MAX_DAYS)) {
      return `Para "rever mais tarde" diz daqui a quantos dias (recheckInDays, de 1 a ${RECHECK_MAX_DAYS}).`;
    }
    const next = {
      ready: AppUpdateStatus.READY,
      todo: AppUpdateStatus.READY,
      waiting: AppUpdateStatus.WAITING,
      later: AppUpdateStatus.LATER,
      cancelled: AppUpdateStatus.CANCELLED,
    }[status];
    const recheckAt =
      next === AppUpdateStatus.LATER ? addDays(now(), days) : null;
    await this.record.save(
      update,
      {
        status: next,
        recheckAt,
        question: next === AppUpdateStatus.WAITING ? comment : null,
        ...(next === AppUpdateStatus.READY ? { installStartedAt: null } : {}),
        ...(next === AppUpdateStatus.CANCELLED ? { finishedAt: now() } : {}),
      },
      `${HEADLINE_ICON[next]} ${comment}${recheckAt ? `\n\n⏸ Volto a ver a ${lisbonTime(recheckAt)}.` : ''}`,
    );
    return `Atualização ${updateLabel(update)} ${update.toVersion} passou a ${next}${recheckAt ? ` (volta ao estudo a ${lisbonTime(recheckAt)})` : ''}.`;
  }

  // ── Disponíveis (vistas pelo MyHomeLab, ainda ninguém as abriu) ─────────

  /** As disponíveis de um utilizador (ou de todos), das mais antigas para as mais novas. */
  async available(userId?: string): Promise<UpdateWithAccount[]> {
    const rows = await this.prisma.appUpdate.findMany({
      where: {
        ...(userId ? { userId } : {}),
        status: AppUpdateStatus.NEW,
        boardTaskId: null,
      },
      include: UPDATE_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(plain);
  }

  /** As disponíveis para que os agendamentos "quando aparece" ainda não correram. */
  async unannounced(): Promise<UpdateWithAccount[]> {
    return (await this.available()).filter((update) => !update.announcedAt);
  }

  async markAnnounced(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await this.prisma.appUpdate.updateMany({
      where: { id: { in: ids } },
      data: { announcedAt: now() },
    });
  }

  /**
   * Um agente abre uma disponível: ganha a tarefa no quadro e o registo e passa para
   * Espera por estudo (o estudo corre na fila de sempre).
   */
  async start(update: UpdateWithAccount, reason: string): Promise<string> {
    if (!isAvailable(update)) {
      return `A ${updateLabel(update)} ${update.toVersion} já foi aberta (está ${STATUS_NAMES[update.status]}${update.boardTaskKey ? `, tarefa ${update.boardTaskKey}` : ''}).`;
    }
    const saved = await this.record.save(
      update,
      { status: AppUpdateStatus.STUDY },
      `▶ Aberta pelo agente: passa para Espera por estudo.${reason.trim() ? ` ${reason.trim()}` : ''}`,
    );
    return `Abri a ${updateLabel(update)} ${update.toVersion}${saved.boardTaskKey ? ` (tarefa ${saved.boardTaskKey})` : ''}: está em Espera por estudo e o estudo começa daqui a pouco.`;
  }

  /** A app foi desligada: as atualizações dela em aberto (não as que estão a correr) ficam canceladas. */
  async cancelForAccount(accountId: string): Promise<void> {
    const open = await this.prisma.appUpdate.findMany({
      where: {
        accountId,
        status: { notIn: [...FINISHED_OR_RUNNING, AppUpdateStatus.FAILED] },
      },
      include: UPDATE_INCLUDE,
    });
    for (const update of open) {
      await this.record.save(
        plain(update),
        { status: AppUpdateStatus.CANCELLED, finishedAt: now() },
        `${HEADLINE_ICON.CANCELLED} A app foi desligada: a atualização ficou cancelada.`,
      );
    }
  }

  async addNote(update: UpdateWithAccount, markdown: string): Promise<string> {
    await this.record.save(update, {}, markdown);
    return update.boardTaskKey
      ? `Nota escrita no registo e na tarefa ${update.boardTaskKey}.`
      : 'Nota escrita no registo da atualização (Documentos).';
  }

  // ── Preparar e correr ───────────────────────────────────────────────────

  /**
   * Antes de atualizar. Na primeira chamada (sem checklist) devolve os documentos,
   * os pontos a verificar e as medições do MyHomeLab (factos, não travões). Na
   * segunda, com a checklist, escreve a especificação no registo. O código não
   * decide nada: o agente segue as regras (o que fazer com um ponto que falha,
   * pedir a aprovação, correr com update_run).
   */
  async prepare(
    update: UpdateWithAccount,
    input: PrepareInput,
  ): Promise<string> {
    if (
      FINISHED_OR_RUNNING.includes(update.status) &&
      !(await pausedInstall(this.prisma, update))
    ) {
      return `Esta atualização está ${update.status}; não há nada a preparar.`;
    }
    if (isHaComponent(update))
      return this.haComponents.prepareComponent(update, input);
    const host = isHostUpdate(update);
    // Sem máquina dita, vale a da app (Apps ligadas → Onde corre).
    const guestRef =
      input.guest ??
      (update.account?.guestVmid != null
        ? String(update.account.guestVmid)
        : undefined);
    if (!host && !guestRef) {
      return 'Falta a máquina (guest): o CT ou VM onde a app corre (está no documento de regras da app, secção "Onde corre").';
    }
    const server = host
      ? (update.hostServer ?? 'O servidor desta atualização já não existe.')
      : await this.serverCommands.findServerByName(update.userId, input.server);
    if (typeof server === 'string') return server;
    const found = host ? null : await findGuest(server, guestRef ?? '');
    if (typeof found === 'string') return found;
    const guest = found;
    const where = guest
      ? `no ${guest.label} (${server.name})`
      : `no host do servidor ${server.name} (os comandos correm no próprio Proxmox; não há snapshot)`;
    // Sem SSH ou sem comandos a tentativa abre na mesma: ficam como pontos medidos.
    const commands = (input.commands ?? [])
      .map((command) => command.trim())
      .filter(Boolean);

    const docs = await updateDocs(
      this.docs,
      update,
      server,
      guest ? guest.ref.guest.vmid : null,
    );
    const points = beforePoints(docs);
    const donePoints = afterPoints(docs);
    const steps = await this.record.stepStates(update);
    const unconfirmed = docs.filter((doc) =>
      /a confirmar/i.test(howToUpdate(doc.content)),
    );
    const measured = [
      ...(guest
        ? await codeChecks(this.prisma, update, server, guest.ref)
        : [
            ...(await commonChecks(this.prisma, update)),
            ...(await hostChecks(server)),
          ]),
      ...readinessChecks(server, commands),
    ];
    const attempt = await this.attempts.open(update, {
      title: `${updateLabel(update)} ${update.fromVersion} → ${update.toVersion}`,
      before: points,
      after: donePoints,
      measured,
      docs: specDocsOf(docs),
      fresh: !input.checklist,
    });

    if (!input.checklist) {
      return (
        `Preparar ${updateLabel(update)} ${update.fromVersion} → ${update.toVersion} ${where}. Agora são ${lisbon(new Date())} (hora de Lisboa).` +
        ((
          [AppUpdateStatus.NEW, AppUpdateStatus.STUDY] as AppUpdateStatus[]
        ).includes(update.status)
          ? ' (Ainda não foi estudada.)'
          : '') +
        `\n\n${ATTEMPT_LEGEND}\n${this.attempts.describe(attempt)}\n\n` +
        (steps.length
          ? `PASSOS À MÃO (sub-tarefas no quadro):\n${steps.map((step) => `- ${step.done ? '✅ feito' : '⏳ por fazer'}: ${step.step}${step.key ? ` (${step.key})` : ''}`).join('\n')}\n\n`
          : '') +
        (unconfirmed.length
          ? `⚠ ESTÁ "A CONFIRMAR" EM: ${unconfirmed.map((doc) => doc.title).join(', ')}.\n\n`
          : '') +
        `DOCUMENTOS OBRIGATÓRIOS DESTA ATUALIZAÇÃO (lê tudo, incluindo o "Nunca"):\n` +
        docs
          .map((doc) => `── ${doc.title} (${doc.id}) ──\n${doc.content.trim()}`)
          .join('\n\n') +
        `\n\nValida cada ponto com as tuas ferramentas e marca-o logo com update_check (o número, validated / not_validated / not_applicable / skipped e a prova: o valor que viste; skipped só por pedido direto dele) — ele vê a tentativa a encher em direto. ` +
        'Quando tiveres tudo, chama outra vez update_prepare com os mesmos dados e checklist: [] para escrever a especificação. As regras dizem o que fazer com um ponto não validado; segue-as.'
      );
    }

    await this.attempts.markMany(
      update.id,
      UpdateCheckPhase.BEFORE,
      input.checklist,
      'agent',
    );
    const checks = await attemptChecks(
      this.attempts,
      update.id,
      UpdateCheckPhase.BEFORE,
      [...measured, ...agentChecks(input.checklist)],
    );
    const specDocs = specDocsOf(docs);
    const spec = specText(update, {
      target: guest
        ? `${guest.label} no servidor ${server.name}`
        : `o host do servidor ${server.name} (Proxmox VE)`,
      commands,
      donePoints,
      checks,
      steps,
      specDocs,
    });
    await this.record.save(
      update,
      {
        serverConnectionId: server.id,
        guestVmid: guest ? guest.ref.guest.vmid : null,
        commands,
        commandId: null,
        checks: checks as unknown as Prisma.InputJsonValue,
        spec,
        specDocs: specDocs,
        afterChecks: Prisma.DbNull,
        verifyStartedAt: null,
      },
      `📜 Especificação escrita.\n\n${spec}`,
    );
    return (
      `A especificação ficou no registo.${checklistGaps(checks)}\n` +
      'Segue as regras: se pedirem a aprovação dele, mostra-lhe a especificação (objetivo, máquina, comandos, feito quando, volta atrás, riscos e a checklist) e espera pelo sim numa mensagem dele. ' +
      (guest
        ? 'Depois corres com update_run (o MyHomeLab faz o snapshot, corre os comandos, confirma a versão nova ou volta ao snapshot, e deixa-a em Verifying) — acompanha com update_status.'
        : 'Depois corres com update_run (no host não há snapshot: o MyHomeLab corre os comandos no servidor e confirma a versão nova; se falhar, fica em Failed sem voltar atrás) — acompanha com update_status.')
    );
  }

  /**
   * Correr uma atualização preparada (snapshot, comandos, versão nova, volta ao
   * snapshot se falhar). Em segundo plano. Quem decide se pode correr são as
   * regras (a aprovação do utilizador), não o código.
   */
  async run(
    update: UpdateWithAccount,
    input: { snapshot?: boolean },
    by: { agentKey: string; turnId: string },
  ): Promise<string> {
    if (isHaComponent(update)) {
      return 'É uma peça do Home Assistant: instala-se pelo próprio Home Assistant, com ha_call_service update.install (backup: true só nos add-ons) (o agente da equipa que tem o ha_call_service).';
    }
    const paused = await pausedInstall(this.prisma, update);
    if (paused && paused.runs >= INSTALL_RUNS) {
      return `Já correu ${paused.runs} vezes, o máximo. Passa-a para Waiting for reply (update_set_status waiting) com o que falhou, a causa provável, o que já tentaste e as opções.`;
    }
    if (!paused && FINISHED_OR_RUNNING.includes(update.status)) {
      return `Esta atualização está ${update.status}.`;
    }
    const host = isHostUpdate(update);
    if (
      !update.serverConnectionId ||
      (!host && update.guestVmid === null) ||
      !update.commands.length
    ) {
      return 'Ainda não foi preparada (falta a máquina e os comandos): usa update_prepare.';
    }
    const server = await this.prisma.serverConnection.findUnique({
      where: { id: update.serverConnectionId },
    });
    if (!server) return 'O servidor desta atualização já não existe.';
    const row = await this.serverCommands.requestUpdate(update.userId, server, {
      command: update.commands.join('\n'),
      reason: `Atualizar ${updateLabel(update)} ${update.fromVersion} → ${update.toVersion}`,
      requestedBy: by.agentKey,
      turnId: by.turnId,
      updateId: update.id,
    });
    const running = await this.prisma.serverCommand.update({
      where: { id: row.id },
      data: { status: 'RUNNING', decidedAt: now() },
    });
    // Já em curso antes de responder: um segundo update_run não a corre outra vez.
    await this.prisma.appUpdate.update({
      where: { id: update.id },
      data: {
        commandId: running.id,
        status: AppUpdateStatus.IN_PROGRESS,
        startedAt: now(),
      },
    });
    await this.attempts.follow({
      ...update,
      status: AppUpdateStatus.IN_PROGRESS,
    });
    void this.runner
      .runApproved(running, {
        snapshot: !host && (input.snapshot ?? true),
      })
      .catch(async (error: unknown) => {
        const why = error instanceof Error ? error.message : String(error);
        await this.serverCommands
          .finishUpdate(running.id, false, why)
          .catch(() => undefined);
        // Um erro fora da corrida (antes do snapshot, a ligação): não fica em In progress
        // para sempre (isso pára a fila), fica Failed e ele recebe o aviso.
        const stuck = await this.prisma.appUpdate.findUnique({
          where: { id: update.id },
        });
        if (stuck?.status === AppUpdateStatus.IN_PROGRESS)
          await this.record.save(
            stuck,
            { status: AppUpdateStatus.FAILED, finishedAt: now() },
            `❌ A corrida parou com um erro: ${why.slice(0, 600)}`,
          );
      });
    return `A atualizar em segundo plano (registo ${running.code}${host ? ', no host, sem snapshot' : input.snapshot === false ? ', sem snapshot' : ''}). Acompanha com update_status; no fim fica em Verifying e verificas com update_verify.`;
  }

  /** As peças do Home Assistant: ver HaComponentsService. */
  checkHomeAssistantComponents(
    account: ConnectedAccount,
    items?: HaUpdateItem[],
  ): Promise<void> {
    return this.haComponents.checkHomeAssistantComponents(account, items);
  }

  /** As apps dentro do Nextcloud: ver NextcloudAppsService. */
  checkNextcloudApps(account: ConnectedAccount): Promise<void> {
    return this.nextcloudApps.checkNextcloudApps(account);
  }

  /** As contas com peças preparadas ou à espera: vê-se mais vezes se já foram instaladas. */
  checkPreparedComponents(): Promise<void> {
    return this.haComponents.checkPreparedComponents();
  }

  /**
   * O "depois de atualizar". Sem checklist devolve os pontos (os da especificação)
   * e os documentos; com ela grava a prova de cada ponto no registo. O agente
   * decide se ficou feito (done) ou se há um problema para o utilizador.
   */
  async verify(
    update: UpdateWithAccount,
    input: {
      checklist?: { point: string; ok: boolean; evidence: string }[];
      done?: boolean;
      note?: string;
    },
  ): Promise<string> {
    if (update.status !== AppUpdateStatus.VERIFYING) {
      return `Esta atualização está ${update.status}; só se verifica depois de instalada (VERIFYING).`;
    }
    const server = update.serverConnectionId
      ? await this.prisma.serverConnection.findUnique({
          where: { id: update.serverConnectionId },
        })
      : null;
    const docs = await updateDocs(this.docs, update, server, update.guestVmid);
    const points = afterPoints(docs);
    const attempt = await this.attempts.current(update.id);
    if (!input.checklist) {
      return (
        `Verificar ${updateLabel(update)} ${update.fromVersion} → ${update.toVersion} (instalada).\n\n` +
        (attempt
          ? `${ATTEMPT_LEGEND}\n${this.attempts.describe(attempt)}\n\n`
          : `FEITO QUANDO (${points.length}), cada um com a prova:\n${points.map((point) => `- ${point}`).join('\n') || '- (nenhum escrito nos documentos)'}\n\n`) +
        `DOCUMENTOS:\n${docs.map((doc) => `── ${doc.title} (${doc.id}) ──\n${doc.content.trim()}`).join('\n\n')}\n\n` +
        'Verifica cada ponto (só leituras; o backup novo é com run_backup) e marca-o com update_check (os do "depois"); no fim chama update_verify outra vez com a checklist [{ point, ok, evidence }] (ou checklist: [] se já marcaste tudo), ' +
        'done: true se ficou tudo bem, ou done: false e a nota com o problema (e diz ao utilizador o que propões: corrigir ou voltar ao snapshot). ' +
        'Um ponto que nenhuma ferramenta tua consegue ver (ex.: abrir a interface) marca-se not_applicable com o porquê e não impede o done: true; done: false só quando algo está mesmo mal.'
      );
    }
    await this.attempts.markMany(
      update.id,
      UpdateCheckPhase.AFTER,
      input.checklist,
      'agent',
    );
    const checks = await attemptChecks(
      this.attempts,
      update.id,
      UpdateCheckPhase.AFTER,
      input.checklist.map((item) => ({
        point: item.point.trim(),
        ok: Boolean(item.ok) && Boolean(item.evidence?.trim()),
        evidence: item.evidence?.trim() || 'sem prova',
        source: 'agent',
      })),
    );
    const done = Boolean(input.done);
    // Não fica feita com pontos do "depois" por marcar: o agente marca-os primeiro.
    const pending = checks.filter(
      (check) => check.evidence === PENDING_EVIDENCE,
    );
    if (done && pending.length) {
      return (
        `Ainda há ${pending.length} pontos do "depois" por validar: ${pending.map((check) => check.point).join(' · ')}. ` +
        'Marca cada um com update_check (com a prova, ou not_applicable com o porquê) e chama update_verify outra vez com checklist: [] e done: true.'
      );
    }
    await this.record.save(
      update,
      {
        afterChecks: checks as unknown as Prisma.InputJsonValue,
        // Com um problema não fica em Verifying (isso pára a fila): passa a Waiting for
        // reply, e a pergunta vai para as notificações dele.
        ...(done
          ? { status: AppUpdateStatus.DONE, finishedAt: now() }
          : {
              status: AppUpdateStatus.WAITING,
              question: verifyQuestion(
                update,
                input.note?.trim() || 'vê o registo da verificação',
              ),
            }),
      },
      `${done ? '🎉 Verificado — ficou tudo bem.' : '⚠ Verificado — há um problema.'}${input.note?.trim() ? ` ${input.note.trim()}` : ''}\n\n${describeChecks(checks)}`,
    );
    return done
      ? 'Verificação gravada no registo; a atualização ficou feita (Done).'
      : 'Verificação gravada; a atualização passou a Waiting for reply com o problema (a pergunta foi para as notificações dele). Diz ao utilizador o problema e o que propões (corrigir ou voltar ao snapshot).';
  }

  /** A verificação não chegou ao fim (sem agente, erro, ou o agente acabou sem update_verify): Waiting for reply. */
  async verifyStalled(id: string, why: string) {
    const update = await this.prisma.appUpdate.findUnique({
      where: { id },
      include: UPDATE_INCLUDE,
    });
    if (update?.status !== AppUpdateStatus.VERIFYING) return;
    await this.record.save(
      update,
      {
        status: AppUpdateStatus.WAITING,
        question: verifyQuestion(
          update,
          `a verificação não acabou (${why.slice(0, 400)})`,
        ),
      },
      `⚠ A verificação não acabou: ${why.slice(0, 600)}`,
    );
  }

  /** Um ponto da tentativa em curso, validado (ou não) pelo agente: update_check. */
  check(
    update: UpdateWithAccount,
    input: { point: number; state: CheckState; evidence: string },
    by: string,
  ): Promise<string> {
    return this.attempts.mark(
      update.id,
      { position: input.point, state: input.state, evidence: input.evidence },
      by,
    );
  }

  /** O agente pára sem atualizar: a tentativa fica guardada (falhada) e no registo. */
  async closeAttempt(
    update: UpdateWithAccount,
    reason: string,
  ): Promise<string> {
    const text = await this.attempts.close(update.id, reason);
    if (!text.startsWith('Tentativa')) return text;
    await this.addNote(update, `⛔ ${text.split(' (')[0]}: ${reason.trim()}`);
    return (
      `${text}
` +
      'Se o que faltou era uma regra que não havia (ou que estava pouco clara), propõe uma versão nova do documento da app (docs_propose com o documento dela: um ponto em "Antes de instalar" ou "Depois de instalar", ou o facto em "Onde corre"). Não cries documentos novos para isto.'
    );
  }

  /** As instaladas por verificar (o agendador põe o agente a verificar cada uma uma vez). */
  pendingVerifications() {
    return this.prisma.appUpdate.findMany({
      where: { status: AppUpdateStatus.VERIFYING, verifyStartedAt: null },
      include: UPDATE_INCLUDE,
      orderBy: { updatedAt: 'asc' },
      take: 5,
    });
  }

  async markVerify(id: string) {
    await this.prisma.appUpdate.update({
      where: { id },
      data: { verifyStartedAt: now() },
    });
  }

  /** O pedido que o agente recebe para verificar uma atualização instalada. */
  verifyRequest(update: AppUpdate): string {
    return (
      `A atualização ${update.id} (${update.fromVersion} → ${update.toVersion}) foi instalada e está em Verifying. ` +
      'Verifica o "feito quando" da especificação com update_verify: primeiro sem checklist para veres os pontos, ' +
      'depois com a prova de cada um. Só leituras e o backup novo; não mudes mais nada.'
    );
  }

  /**
   * O utilizador (ou um agente) mudou a tarefa de coluna no quadro: a atualização
   * acompanha — voltar ao estudo, pronta, à espera, rever mais tarde (o dia é o
   * prazo da tarefa) ou cancelada. As colunas do MyHomeLab mexem-se sozinhas.
   */
  private async onBoardMove(
    change: Parameters<StateListener>[0],
  ): Promise<void> {
    if (!change.updateId || change.actor === 'MyHomeLab' || !change.toKey)
      return;
    const wanted = FROM_BOARD[change.toKey as BoardStatus];
    const update = await this.prisma.appUpdate.findUnique({
      where: { id: change.updateId },
    });
    if (!update || wanted === update.status) return;
    // Uma mudança que não se pode fazer daqui: a tarefa volta à coluna do estado dela
    // (senão o quadro e a atualização ficavam a dizer coisas diferentes).
    if (!wanted || !boardMoveAllowed(update, wanted)) {
      if (change.toKey === BOARD_STATUS[update.status]) return;
      await this.record.save(
        update,
        {},
        `🖐 Não se pode mudar para "${change.toKey}" agora (está em ${STATUS_NAMES[update.status]}): voltou à coluna dela.`,
      );
      return;
    }
    const recheckAt =
      wanted === AppUpdateStatus.LATER
        ? change.dueDate && change.dueDate > now()
          ? change.dueDate
          : addDays(now(), 7)
        : null;
    // Instala-se uma de cada vez: se outra está a correr, fica dito que esta espera por ela.
    const ahead =
      wanted === AppUpdateStatus.READY
        ? await this.prisma.appUpdate.findFirst({
            where: {
              userId: update.userId,
              id: { not: update.id },
              OR: [
                {
                  status: {
                    in: [
                      AppUpdateStatus.IN_PROGRESS,
                      AppUpdateStatus.VERIFYING,
                    ],
                  },
                },
                {
                  status: AppUpdateStatus.READY,
                  installStartedAt: { not: null },
                },
              ],
            },
            include: UPDATE_INCLUDE,
          })
        : null;
    const queued = ahead
      ? `\n\n⏳ Na fila: instala-se quando acabar ${ahead.boardTaskKey ?? updateLabel(ahead)} (${updateLabel(ahead)} ${ahead.toVersion}). Uma de cada vez.`
      : '';
    await this.record.save(
      update,
      {
        status: wanted,
        recheckAt,
        ...(wanted === AppUpdateStatus.READY ? { installStartedAt: null } : {}),
        ...(wanted === AppUpdateStatus.STUDY
          ? {
              studyStartedAt: null,
              studiedAt: null,
              studyError: null,
              studyRetries: 0,
            }
          : {}),
        ...(wanted === AppUpdateStatus.CANCELLED ||
        wanted === AppUpdateStatus.DONE
          ? { finishedAt: now() }
          : {}),
        ...(wanted === AppUpdateStatus.VERIFYING
          ? { verifyStartedAt: null }
          : {}),
      },
      `🖐 Mudada no quadro para ${STATUS_NAMES[wanted]}${recheckAt ? ` (volto a ver a ${lisbonTime(recheckAt)})` : ''}.${queued}`,
    );
  }

  describeStatus(update: UpdateWithAccount): string {
    return describeStatus(update);
  }

  /**
   * O estado para o agente (update_status). Com os comandos a correr, espera até um
   * minuto que acabem, para ele não perguntar sem parar; numa corrida que falhou,
   * diz-lhe o que pode fazer.
   */
  async statusForAgent(update: UpdateWithAccount): Promise<string> {
    let current = update;
    for (let waited = 0; waited < STATUS_WAIT_MS; waited += STATUS_POLL_MS) {
      if (current.status !== AppUpdateStatus.IN_PROGRESS || !current.commandId)
        break;
      const command = await this.prisma.serverCommand.findUnique({
        where: { id: current.commandId },
        select: { status: true },
      });
      if (command?.status !== 'RUNNING') break;
      await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_MS));
      const fresh = await this.prisma.appUpdate.findUnique({
        where: { id: update.id },
        include: UPDATE_INCLUDE,
      });
      if (!fresh) break;
      current = plain(fresh);
    }
    const paused = await pausedInstall(this.prisma, current);
    return (
      describeStatus(current) +
      (paused
        ? `\n\n⏸ A corrida ${paused.runs} de ${INSTALL_RUNS} falhou e voltou ao snapshot (vê o Resultado). Segue "Quando falha": percebe a causa (o erro, o log, as issues). ${paused.runs < INSTALL_RUNS ? 'Se for simples e seguro, corrige o documento da app, update_prepare com os comandos corrigidos e update_run outra vez. ' : ''}Se não, update_set_status waiting com o que falhou, a causa provável, o que tentaste e as opções.`
        : '')
    );
  }

  private async ownedAccount(userId: string, id: string) {
    const account = await this.prisma.connectedAccount.findFirst({
      where: { id, userId },
    });
    if (!account) throw new NotFoundException('App não encontrada');
    return account;
  }
}
