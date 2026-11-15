import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TaskRelationKind } from 'src/generated/prisma/client/client';
import { BoardActor, BoardService, TaskInput } from './board.service';
import { CLOSED_GROUPS } from './helpers/defaultStates';
import { taskKey } from './helpers/projectIdentifier';

const MAX_ATTACHMENT = 10 * 1024 * 1024;
const MAX_BULK = 200;
const DAY_MS = 86_400_000;

const RELATION_NAMES: Record<TaskRelationKind, string> = {
  BLOCKS: 'bloqueia',
  RELATES: 'está relacionada com',
  DUPLICATES: 'repete',
};

/**
 * O resto do quadro: ciclos (sprints), relações entre tarefas, anexos, mudanças em
 * várias tarefas de uma vez e o painel "precisa de ti".
 */
@Injectable()
export class BoardWorkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly board: BoardService,
  ) {}

  // ── Ciclos ──

  async createCycle(
    userId: string,
    projectId: string,
    input: { name: string; startDate: Date; endDate: Date },
  ) {
    await this.board.project(userId, projectId);
    const name = input.name?.trim().slice(0, 80);
    if (!name) throw new BadRequestException('Dá um nome ao ciclo.');
    if (!(input.endDate > input.startDate))
      throw new BadRequestException(
        'O fim do ciclo tem de ser depois do início.',
      );
    return this.prisma.boardCycle.create({
      data: {
        projectId,
        name,
        startDate: input.startDate,
        endDate: input.endDate,
      },
    });
  }

  async updateCycle(
    userId: string,
    id: string,
    input: { name?: string; startDate?: Date; endDate?: Date },
  ) {
    const cycle = await this.board.ownedCycle(userId, id);
    const startDate = input.startDate ?? cycle.startDate;
    const endDate = input.endDate ?? cycle.endDate;
    if (!(endDate > startDate))
      throw new BadRequestException(
        'O fim do ciclo tem de ser depois do início.',
      );
    return this.prisma.boardCycle.update({
      where: { id },
      data: {
        name: input.name?.trim().slice(0, 80) || cycle.name,
        startDate,
        endDate,
      },
    });
  }

  /** As tarefas ficam, só saem do ciclo. */
  async removeCycle(userId: string, id: string) {
    await this.board.ownedCycle(userId, id);
    await this.prisma.boardCycle.delete({ where: { id } });
  }

  // ── Relações ──

  async relate(
    userId: string,
    taskId: string,
    otherRef: string,
    kind: TaskRelationKind,
    actor: BoardActor,
  ) {
    const task = await this.ownedTask(userId, taskId);
    const other = await this.board.findForAgent(userId, otherRef);
    if (typeof other === 'string') throw new BadRequestException(other);
    if (other.id === task.id)
      throw new BadRequestException(
        'Uma tarefa não se relaciona com ela própria.',
      );
    const relation = await this.prisma.boardTaskRelation.upsert({
      where: { fromId_toId_kind: { fromId: task.id, toId: other.id, kind } },
      create: { fromId: task.id, toId: other.id, kind },
      update: {},
    });
    const otherProject = await this.prisma.project.findUniqueOrThrow({
      where: { id: other.projectId },
    });
    await this.prisma.boardTaskActivity.create({
      data: {
        taskId: task.id,
        actor,
        text: `Esta tarefa ${RELATION_NAMES[kind]} ${taskKey(otherProject.identifier, other.number)}.`,
      },
    });
    return relation;
  }

  async unrelate(userId: string, relationId: string) {
    const relation = await this.prisma.boardTaskRelation.findFirst({
      where: { id: relationId, from: { userId } },
    });
    if (!relation) throw new NotFoundException('Esta relação já não existe.');
    await this.prisma.boardTaskRelation.delete({ where: { id: relationId } });
  }

  // ── Anexos ──

  async attach(
    userId: string,
    taskId: string,
    file:
      | { originalname: string; mimetype: string; size: number; buffer: Buffer }
      | undefined,
    actor: BoardActor,
  ) {
    await this.ownedTask(userId, taskId);
    if (!file?.buffer?.length)
      throw new BadRequestException('Escolhe um ficheiro.');
    if (file.size > MAX_ATTACHMENT)
      throw new BadRequestException('O anexo pode ter até 10 MB.');
    const name = Buffer.from(file.originalname, 'latin1')
      .toString('utf8')
      .slice(0, 200);
    const attachment = await this.prisma.boardTaskAttachment.create({
      data: {
        taskId,
        name,
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size,
        data: new Uint8Array(file.buffer),
        createdBy: actor,
      },
      select: {
        id: true,
        name: true,
        mimeType: true,
        size: true,
        createdBy: true,
        createdAt: true,
      },
    });
    await this.prisma.boardTaskActivity.create({
      data: { taskId, actor, text: `Anexou "${name}".` },
    });
    return attachment;
  }

  async attachment(userId: string, id: string) {
    const attachment = await this.prisma.boardTaskAttachment.findFirst({
      where: { id, task: { userId } },
    });
    if (!attachment) throw new NotFoundException('Este anexo já não existe.');
    return attachment;
  }

  async removeAttachment(userId: string, id: string) {
    const attachment = await this.attachment(userId, id);
    await this.prisma.boardTaskAttachment.delete({ where: { id } });
    await this.prisma.boardTaskActivity.create({
      data: {
        taskId: attachment.taskId,
        actor: 'user',
        text: `Tirou o anexo "${attachment.name}".`,
      },
    });
  }

  // ── Várias de uma vez ──

  async bulkUpdate(
    userId: string,
    ids: string[],
    input: TaskInput,
    actor: BoardActor,
  ) {
    const unique = [...new Set(ids)].slice(0, MAX_BULK);
    let changed = 0;
    const failed: string[] = [];
    for (const id of unique) {
      try {
        await this.board.updateTask(userId, id, input, actor);
        changed++;
      } catch (error) {
        failed.push(error instanceof Error ? error.message : String(error));
      }
    }
    return { changed, failed };
  }

  // ── Precisa de ti ──

  /** O que está à espera dele: perguntas, disparos que falharam, prazos de hoje e tentativas a meio. */
  async attention(userId: string) {
    const now = new Date();
    // O fim do dia em Lisboa (a diferença para UTC muda no horário de verão).
    const lisbonOffset =
      new Date(
        now.toLocaleString('en-US', { timeZone: 'Europe/Lisbon' }),
      ).getTime() -
      new Date(now.toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
    const endOfToday = new Date(
      Date.parse(
        now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Lisbon' }) +
          'T23:59:59Z',
      ) - lisbonOffset,
    );
    const [waiting, due, schedules, attempts, notifications] =
      await Promise.all([
        this.prisma.boardTask.findMany({
          where: {
            userId,
            OR: [
              { awaitingReply: true },
              // "Rever mais tarde" das atualizações não precisa dele; as colunas sem chave são dos projetos gerais.
              { state: { group: 'WAITING', key: null } },
              { state: { group: 'WAITING', key: { not: 'later' } } },
            ],
          },
          include: {
            state: true,
            project: true,
            comments: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
          orderBy: { updatedAt: 'desc' },
          take: 30,
        }),
        this.prisma.boardTask.findMany({
          where: {
            userId,
            dueDate: { lte: endOfToday },
            state: { group: { notIn: CLOSED_GROUPS } },
          },
          include: { state: true, project: true },
          orderBy: { dueDate: 'asc' },
          take: 30,
        }),
        this.prisma.agentSchedule.findMany({
          where: {
            userId,
            runs: {
              some: {
                status: 'FAILED',
                startedAt: { gte: new Date(now.getTime() - DAY_MS) },
              },
            },
          },
          include: { runs: { orderBy: { startedAt: 'desc' }, take: 1 } },
          take: 20,
        }),
        this.prisma.updateAttempt.findMany({
          where: { userId, status: 'CHECKING' },
          include: {
            account: { select: { displayName: true, provider: true } },
            hostServer: { select: { name: true } },
          },
          orderBy: { startedAt: 'desc' },
          take: 10,
        }),
        this.prisma.notification.count({ where: { userId, resolvedAt: null } }),
      ]);
    const view = (task: (typeof due)[number]) => ({
      id: task.id,
      key: taskKey(task.project.identifier, task.number),
      title: task.title,
      state: task.state,
      project: task.project.name,
      dueDate: task.dueDate,
      priority: task.priority,
    });
    return {
      waiting: waiting.map((task) => ({
        ...view(task),
        question:
          task.comments[0]?.author !== 'user'
            ? (task.comments[0]?.body ?? null)
            : null,
      })),
      due: due.map(view),
      failedTriggers: schedules
        .filter((schedule) => schedule.runs[0]?.status === 'FAILED')
        .map((schedule) => ({
          id: schedule.id,
          title: schedule.title,
          at: schedule.runs[0].startedAt,
          error: schedule.runs[0].summary,
        })),
      attempts: attempts.map((attempt) => ({
        id: attempt.id,
        title: attempt.title,
        app: attempt.account
          ? (attempt.account.displayName ?? attempt.account.provider)
          : `Proxmox VE · ${attempt.hostServer?.name ?? 'servidor'}`,
        startedAt: attempt.startedAt,
      })),
      notifications,
    };
  }

  private async ownedTask(userId: string, id: string) {
    const task = await this.prisma.boardTask.findFirst({
      where: { id, userId },
    });
    if (!task) throw new NotFoundException('Esta tarefa já não existe.');
    return task;
  }
}
