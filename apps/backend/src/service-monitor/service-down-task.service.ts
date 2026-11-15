import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AgentScheduleRepeat,
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

/**
 * Um serviço que falha vira uma tarefa no quadro do servidor dele, e o agente de
 * infraestrutura é disparado para a estudar. Aqui só se regista e dispara: o que o
 * agente faz (estudar, perguntar, resolver) está no documento de processo, para o
 * utilizador o poder mudar sem mexer no código.
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

  /** O serviço voltou: fica dito na tarefa aberta (a tarefa não fecha sozinha). */
  async cameBack(monitor: ServiceMonitor, result: CheckResult, at: Date) {
    if (monitor.status !== 'DOWN') return;
    const open = await this.openTask(monitor);
    if (!open) return;
    const latency = result.latencyMs != null ? ` (${result.latencyMs} ms)` : '';
    await this.board.comment(
      monitor.userId,
      open.id,
      `Voltou a responder às ${lisbonTime(at)}${latency}.`,
      ACTOR,
    );
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
      select: { id: true },
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
