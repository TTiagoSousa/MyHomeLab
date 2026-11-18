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

const minutesBetween = (from: Date, to: Date) =>
  Math.max(1, Math.round((to.getTime() - from.getTime()) / 60_000));

/**
 * Um serviço que falha vira uma tarefa no quadro do servidor dele, e o agente de
 * infraestrutura é disparado para a estudar. O caminho da tarefa é daqui: quando o serviço
 * volta passa a Verifying e, estável durante 10 minutos, fecha-se sozinha (Done) — sem
 * depender de o agente a fechar. Uma falha durante uma atualização dessa app (ou do
 * Proxmox do servidor) não abre tarefa: fica dita na tarefa da atualização. O que o agente
 * faz (estudar, perguntar, resolver) está no documento de processo.
 */
@Injectable()
export class ServiceDownTaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly board: BoardService,
  ) {}

  /**
   * O serviço está em baixo. Com uma tarefa ainda aberta não se cria outra — só se
   * comenta se voltou a falhar depois de ter recuperado.
   */
  async wentDown(
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
      }
      return;
    }
    // A mesma falha continua e a tarefa dela já foi fechada: só uma nova falha abre outra.
    if (monitor.status === 'DOWN' && monitor.downTaskId) return;
    // Uma atualização a correr (ou que acabou agora) explica a falha: não é um problema novo.
    const update = await this.updateInProgress(monitor, at);
    if (update) {
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
      if (open.state.key !== 'waiting') {
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
      select: { id: true, createdAt: true, state: { select: { key: true } } },
    });
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
