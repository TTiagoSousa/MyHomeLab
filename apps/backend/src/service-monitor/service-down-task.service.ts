import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AgentScheduleRepeat,
  AppUpdateStatus,
  DocLinkType,
  ProjectKind,
  ServiceMonitor,
  TaskPriority,
} from 'src/generated/prisma/client/client';
import { BoardService } from 'src/board/board.service';
import { CLOSED_GROUPS } from 'src/board/helpers/defaultStates';
import { taskKey } from 'src/board/helpers/projectIdentifier';
import { CheckResult } from './helpers/checkTarget';
import { downTaskText } from './helpers/downTaskText';
import { lisbonTime } from './helpers/lisbonTime';

/** O agente que estuda as falhas é o que corre comandos nos servidores (o Engenheiro de Servidores). */
const STUDY_TOOL = 'server_run_command';
const ACTOR = 'MyHomeLab';
/** Depois de voltar, a tarefa fecha-se sozinha se o serviço responder sem falhar durante isto. */
const STABLE_MS = 10 * 60_000;
/** Uma atualização que acabou há menos disto ainda explica uma falha (o serviço a arrancar). */
const UPDATE_GRACE_MS = 15 * 60_000;
/** Serviços do mesmo servidor que caem dentro disto juntam-se numa só tarefa. */
const GROUP_MS = 5 * 60_000;
/** Depois de fechada, uma nova queda do mesmo serviço não chama outro agente durante isto (como os discos). */
const PAUSE_MS = 6 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
/** O comentário de uma tarefa reaberta dentro da pausa (conta as quedas). */
const REOPEN_MARK = '🔁';

const minutesBetween = (from: Date, to: Date) =>
  Math.max(1, Math.round((to.getTime() - from.getTime()) / 60_000));

/**
 * Um serviço que falha vira uma tarefa no quadro do servidor dele, e o agente de
 * infraestrutura é disparado para a estudar. O caminho da tarefa é daqui: quando o serviço
 * volta passa a Verifying e, estável durante 10 minutos, fecha-se sozinha (Done) — sem
 * depender de o agente a fechar. Uma falha durante uma atualização dessa app (ou do
 * Proxmox do servidor) não abre tarefa: fica dita na tarefa da atualização. Os serviços
 * do mesmo servidor que caem juntos (5 min) partilham uma tarefa e um agente, e uma queda
 * nova até 6 horas depois de fechada reabre a tarefa sem chamar outro agente. O que o agente
 * faz (estudar, perguntar, resolver) está no documento de processo.
 */
@Injectable()
export class ServiceDownTaskService {
  private readonly downQueue = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly board: BoardService,
  ) {}

  /**
   * O serviço está em baixo. Com uma tarefa ainda aberta não se cria outra — só se
   * comenta se voltou a falhar depois de ter recuperado.
   */
  wentDown(
    monitor: ServiceMonitor,
    result: CheckResult,
    at: Date,
  ): Promise<void> {
    // Os serviços verificam-se 5 de cada vez: as quedas do mesmo servidor tratam-se uma
    // a uma, para a segunda já ver a tarefa da primeira (e juntar-se a ela).
    const server = monitor.serverConnectionId;
    if (!server) return this.handleDown(monitor, result, at);
    const previous = this.downQueue.get(server) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => this.handleDown(monitor, result, at));
    this.downQueue.set(server, next);
    return next;
  }

  private async handleDown(
    monitor: ServiceMonitor,
    result: CheckResult,
    at: Date,
  ): Promise<void> {
    if (monitor.recoveredAt) {
      await this.prisma.serviceMonitor.update({
        where: { id: monitor.id },
        data: { recoveredAt: null },
      });
    }
    const open = await this.openTask(monitor);
    if (open) {
      if (monitor.status !== 'DOWN') {
        await this.board.comment(
          monitor.userId,
          open.id,
          `Voltou a falhar às ${lisbonTime(at)}: ${result.error ?? 'sem resposta'}.`,
          ACTOR,
        );
        // Tinha voltado há pouco (Verifying): ficava lá com o serviço em baixo e
        // ninguém olhava para a segunda queda.
        if (open.state.key === 'verifying') {
          await this.board.updateTask(
            monitor.userId,
            open.id,
            { stateKey: 'in_progress' },
            ACTOR,
          );
          const agentKey = await this.studyAgent(monitor.userId);
          if (agentKey && !(await this.dispatchedSince(open.id, at))) {
            await this.dispatch(
              monitor,
              {
                id: open.id,
                key: taskKey(open.project.identifier, open.number),
                title: open.title,
              },
              agentKey,
            );
          }
        }
      }
      return;
    }
    // A mesma falha continua e a tarefa dela já foi fechada: só uma nova falha abre outra.
    if (monitor.status === 'DOWN' && monitor.downTaskId) return;
    // Uma atualização a correr (ou que acabou agora) explica a falha: não é um problema novo.
    const update = await this.updateInProgress(monitor, at);
    if (update) {
      // Esquece a queda antiga: se o serviço não voltar depois da atualização, a
      // verificação seguinte abre tarefa (com o downTaskId antigo ficava calado para sempre).
      if (monitor.downTaskId) {
        await this.prisma.serviceMonitor.update({
          where: { id: monitor.id },
          data: { downTaskId: null },
        });
      }
      if (monitor.status !== 'DOWN' && update.boardTaskId) {
        await this.board
          .comment(
            monitor.userId,
            update.boardTaskId,
            `ℹ O serviço ${monitor.name} deixou de responder às ${lisbonTime(at)} durante a atualização (${result.error ?? 'sem resposta'}). Não abri tarefa de falha: se não voltar depois da atualização, abre-se uma.`,
            ACTOR,
          )
          .catch(() => undefined);
      }
      return;
    }

    // O servidor inteiro caiu: os serviços dele que caem ao mesmo tempo juntam-se à
    // tarefa do primeiro, com um só agente (eram N tarefas e N agentes pagos à mesma causa).
    const sibling = await this.siblingTask(monitor, at);
    if (sibling) {
      await this.prisma.serviceMonitor.update({
        where: { id: monitor.id },
        data: { downTaskId: sibling.id },
      });
      await this.board.comment(
        monitor.userId,
        sibling.id,
        `Também deixou de responder às ${lisbonTime(at)}: ${monitor.name} (${result.error ?? 'sem resposta'}). Deve ser a mesma causa (o mesmo servidor).`,
        ACTOR,
      );
      return;
    }
    // Um serviço que vai e vem: dentro da pausa reabre a última tarefa, sem outro agente.
    const recent = await this.recentlyClosed(monitor, at);
    if (recent) {
      const since = new Date(at.getTime() - DAY_MS);
      const falls =
        (await this.prisma.boardTaskComment.count({
          where: {
            taskId: recent.id,
            author: ACTOR,
            body: { startsWith: REOPEN_MARK },
            createdAt: { gt: since },
          },
        })) + 2;
      await this.board.updateTask(
        monitor.userId,
        recent.id,
        { stateKey: 'new' },
        ACTOR,
      );
      await this.board.comment(
        monitor.userId,
        recent.id,
        `${REOPEN_MARK} Voltou a falhar às ${lisbonTime(at)} (${result.error ?? 'sem resposta'}), menos de 6 horas depois de fechada: caiu ${falls} vezes nas últimas 24 h, é instável. Não chamei o agente outra vez sozinho; se quiseres que estude, comenta aqui.`,
        ACTOR,
      );
      return;
    }

    const project = await this.projectFor(
      monitor.userId,
      monitor.serverConnectionId,
    );
    const server = monitor.serverConnectionId
      ? await this.prisma.serverConnection.findUnique({
          where: { id: monitor.serverConnectionId },
          select: { name: true },
        })
      : null;
    const { title, description } = downTaskText(
      monitor,
      result,
      server?.name ?? null,
      at,
    );
    const agentKey = await this.studyAgent(monitor.userId);
    // Fica em Todo (a coluna de estudo é das atualizações), com prioridade alta.
    const task = await this.board.createTask(
      monitor.userId,
      {
        projectId: project.id,
        title,
        description,
        stateKey: 'new',
        priority: TaskPriority.HIGH,
        assignee: agentKey,
        labels: ['falha'],
      },
      ACTOR,
    );
    await this.prisma.serviceMonitor.update({
      where: { id: monitor.id },
      data: { downTaskId: task.id },
    });
    if (agentKey) await this.dispatch(monitor, task, agentKey);
  }

  /**
   * O serviço respondeu. Se estava em baixo, a tarefa aberta passa a Verifying (fica dito
   * quanto tempo esteve em baixo), menos se estiver à espera de uma resposta dele. Se já
   * tinha voltado e está estável há 10 minutos, a tarefa em Verifying fecha-se (Done).
   */
  async cameBack(monitor: ServiceMonitor, result: CheckResult, at: Date) {
    if (monitor.status === 'DOWN') {
      const open = await this.openTask(monitor);
      if (!open) return;
      await this.prisma.serviceMonitor.update({
        where: { id: monitor.id },
        data: { recoveredAt: at },
      });
      const latency =
        result.latencyMs != null ? ` (${result.latencyMs} ms)` : '';
      await this.board.comment(
        monitor.userId,
        open.id,
        `✅ Voltou a responder às ${lisbonTime(at)}${latency}, depois de uns ${minutesBetween(open.createdAt, at)} min em baixo. Se ficar estável 10 minutos, o MyHomeLab fecha esta tarefa.`,
        ACTOR,
      );
      if (
        open.state.key !== 'waiting' &&
        !(await this.othersDown(monitor, open.id))
      ) {
        await this.board.updateTask(
          monitor.userId,
          open.id,
          { stateKey: 'verifying' },
          ACTOR,
        );
      }
      return;
    }
    if (!monitor.recoveredAt) return;
    if (at.getTime() - monitor.recoveredAt.getTime() < STABLE_MS) return;
    await this.prisma.serviceMonitor.update({
      where: { id: monitor.id },
      data: { recoveredAt: null },
    });
    const open = await this.openTask(monitor);
    // Mexeram na tarefa entretanto (ele ou o agente): fica como a deixaram.
    if (!open || open.state.key !== 'verifying') return;
    if (await this.othersDown(monitor, open.id)) return;
    await this.board.comment(
      monitor.userId,
      open.id,
      `✅ Estável desde as ${lisbonTime(monitor.recoveredAt)}: fechada pelo MyHomeLab. Se a causa não estiver escrita aqui, vê os comentários do agente.`,
      ACTOR,
    );
    await this.board.updateTask(
      monitor.userId,
      open.id,
      { stateKey: 'done' },
      ACTOR,
    );
  }

  /** O serviço deixou de ser vigiado (app desligada ou apagado): a tarefa da falha fecha. */
  async closeRemoved(monitor: ServiceMonitor): Promise<void> {
    const open = await this.openTask(monitor);
    if (!open || (await this.othersDown(monitor, open.id))) return;
    await this.board.comment(
      monitor.userId,
      open.id,
      `O serviço ${monitor.name} deixou de ser vigiado (a app foi desligada ou removida): fechada pelo MyHomeLab.`,
      ACTOR,
    );
    await this.board.updateTask(
      monitor.userId,
      open.id,
      { stateKey: 'cancelled' },
      ACTOR,
    );
  }

  /**
   * A atualização desta app (ou do Proxmox do servidor dela) que está a correr ou acabou
   * há pouco: o serviço em baixo é o normal de uma instalação.
   */
  private updateInProgress(monitor: ServiceMonitor, at: Date) {
    const targets = [
      ...(monitor.accountId ? [{ accountId: monitor.accountId }] : []),
      ...(monitor.serverConnectionId
        ? [{ hostServerId: monitor.serverConnectionId }]
        : []),
    ];
    if (!targets.length) return Promise.resolve(null);
    return this.prisma.appUpdate.findFirst({
      where: {
        userId: monitor.userId,
        OR: targets,
        AND: [
          {
            OR: [
              {
                status: {
                  in: [AppUpdateStatus.IN_PROGRESS, AppUpdateStatus.VERIFYING],
                },
              },
              { finishedAt: { gt: new Date(at.getTime() - UPDATE_GRACE_MS) } },
            ],
          },
        ],
      },
      select: { id: true, boardTaskId: true },
    });
  }

  /** A tarefa da última falha, se ainda existir e não estiver fechada. */
  private openTask(monitor: ServiceMonitor) {
    if (!monitor.downTaskId) return Promise.resolve(null);
    return this.prisma.boardTask.findFirst({
      where: {
        id: monitor.downTaskId,
        userId: monitor.userId,
        state: { group: { notIn: CLOSED_GROUPS } },
      },
      select: {
        id: true,
        number: true,
        title: true,
        createdAt: true,
        state: { select: { key: true } },
        project: { select: { identifier: true } },
      },
    });
  }

  /** A tarefa aberta há pouco de outro serviço do mesmo servidor, que caiu ao mesmo tempo. */
  private async siblingTask(monitor: ServiceMonitor, at: Date) {
    if (!monitor.serverConnectionId) return null;
    const siblings = await this.prisma.serviceMonitor.findMany({
      where: {
        userId: monitor.userId,
        serverConnectionId: monitor.serverConnectionId,
        id: { not: monitor.id },
        status: 'DOWN',
        downTaskId: { not: null },
      },
      select: { downTaskId: true },
    });
    if (!siblings.length) return null;
    return this.prisma.boardTask.findFirst({
      where: {
        id: { in: siblings.map((sibling) => sibling.downTaskId!) },
        userId: monitor.userId,
        createdAt: { gt: new Date(at.getTime() - GROUP_MS) },
        state: { group: { notIn: CLOSED_GROUPS } },
      },
      select: { id: true },
    });
  }

  /** A tarefa da última falha, fechada há menos de 6 horas (dentro da pausa). */
  private recentlyClosed(monitor: ServiceMonitor, at: Date) {
    if (!monitor.downTaskId) return Promise.resolve(null);
    return this.prisma.boardTask.findFirst({
      where: {
        id: monitor.downTaskId,
        userId: monitor.userId,
        completedAt: { gt: new Date(at.getTime() - PAUSE_MS) },
      },
      select: { id: true },
    });
  }

  /** Outro serviço ligado à mesma tarefa ainda está em baixo (a tarefa não passa a Verifying). */
  private async othersDown(monitor: ServiceMonitor, taskId: string) {
    const count = await this.prisma.serviceMonitor.count({
      where: { downTaskId: taskId, id: { not: monitor.id }, status: 'DOWN' },
    });
    return count > 0;
  }

  /** Já se chamou o agente para esta tarefa há menos de 6 horas. */
  private async dispatchedSince(taskId: string, at: Date) {
    const count = await this.prisma.agentSchedule.count({
      where: {
        linkType: DocLinkType.TASK,
        targetId: taskId,
        createdAt: { gt: new Date(at.getTime() - PAUSE_MS) },
      },
    });
    return count > 0;
  }

  /** O projeto do servidor do serviço; sem ele, o primeiro das atualizações. */
  private async projectFor(userId: string, serverConnectionId: string | null) {
    const own = serverConnectionId
      ? await this.prisma.project.findFirst({
          where: { userId, kind: ProjectKind.UPDATES, serverConnectionId },
          orderBy: { position: 'asc' },
        })
      : null;
    if (own) return own;
    const first = await this.prisma.project.findFirst({
      where: { userId, kind: ProjectKind.UPDATES },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return first ?? this.board.ensureUpdatesProject(userId);
  }

  /** O agente ativo que corre comandos nos servidores, ou null (a tarefa fica sem responsável). */
  private async studyAgent(userId: string): Promise<string | null> {
    const agent = await this.prisma.agent.findFirst({
      where: { userId, isActive: true, tools: { has: STUDY_TOOL } },
      orderBy: { createdAt: 'asc' },
      select: { key: true },
    });
    return agent?.key ?? null;
  }

  /** O disparo do agente (aparece em Disparos, ligado à tarefa). */
  private async dispatch(
    monitor: ServiceMonitor,
    task: { id: string; key: string; title: string },
    agentKey: string,
  ) {
    const now = new Date();
    await this.prisma.agentSchedule.create({
      data: {
        userId: monitor.userId,
        agentKey,
        title: `Estudar a falha de ${monitor.name}`.slice(0, 200),
        instruction:
          `O serviço ${monitor.name} deixou de responder: tarefa ${task.key}. ` +
          'Segue o documento "Serviço em baixo – como se trata" (lê a tarefa com board_get).',
        repeat: AgentScheduleRepeat.ONCE,
        runAt: now,
        nextRunAt: now,
        notify: false,
        createdBy: ACTOR,
        tags: ['falha'],
        linkType: DocLinkType.TASK,
        targetId: task.id,
        targetLabel: `${task.key} ${task.title}`.slice(0, 200),
      },
    });
  }
}
