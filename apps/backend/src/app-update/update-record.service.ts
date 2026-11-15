import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AppUpdate,
  AppUpdateStatus,
  DocLinkType,
  NotificationKind,
  Prisma,
} from 'src/generated/prisma/client/client';
import { DocsService } from 'src/docs/docs.service';
import { normalizeText } from 'src/docs/helpers/docText';
import { BoardService } from 'src/board/board.service';
import { NotificationService } from 'src/notification/notification.service';
import { TodoService } from 'src/todo/todo.service';
import { updatesBoard } from './task-board/taskBoard';
import { UpdateAttemptService } from './update-attempt.service';
import {
  BOARD_STATUS,
  COMPONENT_LABELS,
  HISTORY_MAX,
  HISTORY_TEXT_MAX,
  UPDATE_INCLUDE,
} from './app-update.constants';
import { StepState, StepTask, UpdateWithAccount } from './app-update.types';
import { readSetting } from './helpers/readSetting';
import { answeredNote, replyTodoSubject } from './helpers/replyTodo';
import { logContent, logTitle } from './helpers/logContent';
import { taskDescription } from './helpers/taskDescription';
import { taskDates, taskLinks, taskTitle } from './helpers/taskFields';
import { now } from './helpers/updateDates';
import {
  appName,
  historyOf,
  isAvailable,
  stepTasksOf,
  targetLink,
  updateLabel,
} from './helpers/updateFields';
import { updatesAgentKey } from 'src/agent/helpers/updatesAgentKey';

/** A notificação da pergunta de uma atualização: "update-waiting:<atualização>:<tarefa>". */
export const waitingSubject = (update: Pick<AppUpdate, 'id' | 'boardTaskId'>) =>
  `update-waiting:${update.id}:${update.boardTaskId ?? ''}`;

/** O aviso do fim de uma atualização (instalada ou falhada): "update-result:<atualização>:<tarefa>". */
export const resultSubject = (update: Pick<AppUpdate, 'id' | 'boardTaskId'>) =>
  `update-result:${update.id}:${update.boardTaskId ?? ''}`;

// O aviso pode ter nascido antes da tarefa (sem ela no assunto): fecha-se também esse.
const withoutTask = (update: Pick<AppUpdate, 'id' | 'boardTaskId'>) =>
  update.boardTaskId ? [{ ...update, boardTaskId: null }] : [];

type BoardTarget = Awaited<ReturnType<UpdateRecordService['boardTarget']>>;

/**
 * Onde uma atualização fica escrita: o histórico, o registo em Documentos e a
 * tarefa do quadro (com as sub-tarefas dos passos à mão).
 */
@Injectable()
export class UpdateRecordService {
  private readonly logger = new Logger('AppUpdateService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly docs: DocsService,
    private readonly attempts: UpdateAttemptService,
    private readonly board: BoardService,
    private readonly notifications: NotificationService,
    private readonly todos: TodoService,
  ) {}

  /**
   * Grava a mudança e leva-a a todo o lado: o histórico (com `event`), o registo
   * em Documentos e a tarefa do quadro (estado, título, relatório, datas e um
   * comentário). Um quadro em baixo não estraga a atualização — o erro fica em
   * `boardError`.
   */
  async save(
    update: AppUpdate,
    data: Prisma.AppUpdateUncheckedUpdateInput,
    event?: string,
    options: { links?: boolean } = {},
  ) {
    const history = event
      ? [
          ...historyOf(update),
          { at: now().toISOString(), text: event.slice(0, HISTORY_TEXT_MAX) },
        ].slice(-HISTORY_MAX)
      : undefined;
    const stored = await this.prisma.appUpdate.update({
      where: { id: update.id },
      data: {
        ...data,
        ...(history
          ? { history: history as unknown as Prisma.InputJsonValue }
          : {}),
      },
      include: UPDATE_INCLUDE,
    });
    if (stored.status !== update.status)
      await this.attempts.follow(stored, event);
    // Disponível (ninguém a tratou ainda): sem registo nem tarefa até um agente a abrir.
    // Uma que acaba sem nunca ter sido aberta (instalada à mão, app desligada) também.
    const neverOpened =
      isAvailable(update) &&
      (
        [AppUpdateStatus.DONE, AppUpdateStatus.CANCELLED] as AppUpdateStatus[]
      ).includes(stored.status);
    if (isAvailable(stored) || neverOpened) return stored;
    await this.followQuestion(update, stored);
    await this.followResult(update, stored);
    const saved = await this.syncLog(stored);
    const target = await this.boardTarget(update.userId);
    if (!target) return saved;
    if (!saved.boardTaskId) {
      const taskId = await this.createTask(saved);
      if (taskId && event) {
        await target.board
          .comment(target.projectId, taskId, event)
          .catch((error) => this.boardFailed(saved.id, error));
      }
      const created = await this.prisma.appUpdate.findUnique({
        where: { id: saved.id },
        include: UPDATE_INCLUDE,
      });
      return created ?? saved;
    }
    try {
      await target.board.updateTask(target.projectId, saved.boardTaskId, {
        status: BOARD_STATUS[saved.status],
        title: taskTitle(saved),
        description: taskDescription(saved),
        ...taskDates(saved),
      });
      if (event)
        await target.board.comment(target.projectId, saved.boardTaskId, event);
      // Cancelada a atualização, os passos à mão dela que ainda estão abertos também se cancelam.
      if (
        saved.status === AppUpdateStatus.CANCELLED &&
        update.status !== AppUpdateStatus.CANCELLED
      ) {
        for (const step of stepTasksOf(saved)) {
          if (await target.board.isClosed(step.id)) continue;
          await target.board.updateTask(target.projectId, step.id, {
            status: BOARD_STATUS[AppUpdateStatus.CANCELLED],
          });
        }
      }
      if (options.links) {
        await target.board
          .addLinks(target.projectId, saved.boardTaskId, taskLinks(saved))
          .catch((error: unknown) =>
            this.logger.warn(
              `Quadro de tarefas (links): ${error instanceof Error ? error.message : String(error)}`,
            ),
          );
      }
      if (saved.boardError) {
        await this.prisma.appUpdate.update({
          where: { id: saved.id },
          data: { boardError: null },
        });
      }
    } catch (error) {
      await this.boardFailed(saved.id, error);
    }
    return saved;
  }

  /**
   * Em Waiting for reply, a pergunta vai para as Notificações (Precisa de ti, com o
   * link para a tarefa, onde ele decide) e fecha quando a atualização deixa de esperar.
   */
  private async followQuestion(before: AppUpdate, after: UpdateWithAccount) {
    const subject = waitingSubject(after);
    try {
      if (after.status === AppUpdateStatus.WAITING) {
        if (
          before.status === after.status &&
          before.question === after.question
        )
          return;
        for (const orphan of withoutTask(after))
          await this.notifications.resolveUserSubject(
            after.userId,
            waitingSubject(orphan),
            NotificationKind.AGENT_NOTICE,
          );
        await this.notifications.openUserSubject({
          userId: after.userId,
          subject,
          kind: NotificationKind.AGENT_NOTICE,
          title: `${updateLabel(after)} ${after.toVersion} precisa de uma resposta`,
          message:
            after.question ??
            'O agente precisa de uma resposta tua: vê a tarefa da atualização.',
        });
      } else {
        // Fora de Waiting a pergunta já não faz falta, venha de onde vier (outro estudo,
        // o quadro, uma mudança feita por fora): o aviso e a tarefa "responder" fecham.
        for (const each of [after, ...withoutTask(after)])
          await this.notifications.resolveUserSubject(
            after.userId,
            waitingSubject(each),
            NotificationKind.AGENT_NOTICE,
          );
        await this.todos.closeSubject(
          after.userId,
          replyTodoSubject(after.id),
          answeredNote(after.status),
        );
      }
    } catch (error) {
      this.logger.warn(
        `Aviso da pergunta: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Quando acaba (Done ou Failed), ele recebe um aviso com o que se fez: é assim que
   * sabe das que se instalaram sozinhas. Um Failed é vermelho; um Done, azul.
   */
  private async followResult(before: AppUpdate, after: UpdateWithAccount) {
    if (before.status === after.status) return;
    // Uma falha que se tenta outra vez (ou que acabou bem) já não é notícia: o "Falhou"
    // fecha. O "Instalado" é de outro tipo e não o substituía.
    if (after.status !== AppUpdateStatus.FAILED) {
      for (const each of [after, ...withoutTask(after)])
        await this.notifications
          .resolveUserSubject(
            after.userId,
            resultSubject(each),
            NotificationKind.APP_PROBLEM,
          )
          .catch(() => undefined);
    }
    const done = after.status === AppUpdateStatus.DONE;
    if (!done && after.status !== AppUpdateStatus.FAILED) return;
    // Fechar uma que nunca se instalou (ex.: já estava instalada) não é notícia.
    if (done && !after.installStartedAt && !after.verifyStartedAt) return;
    const label = `${updateLabel(after)} ${after.toVersion}${after.boardTaskKey ? ` (${after.boardTaskKey})` : ''}`;
    try {
      await this.notifications.openUserSubject({
        userId: after.userId,
        subject: resultSubject(after),
        kind: done
          ? NotificationKind.AGENT_NOTICE
          : NotificationKind.APP_PROBLEM,
        title: done ? `Instalado: ${label}` : `Falhou: ${label}`,
        message: (
          (done
            ? `${updateLabel(after)} está na ${after.toVersion} e verificado.`
            : 'A instalação falhou; vê a tarefa.') +
          (after.result ? `\n\n${after.result.split('\n')[0]}` : '')
        ).slice(0, 1000),
      });
    } catch (error) {
      this.logger.warn(
        `Aviso do fim: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** As sub-tarefas dos passos à mão e se já estão fechadas no quadro. */
  async stepStates(update: UpdateWithAccount): Promise<StepState[]> {
    const tasks = stepTasksOf(update);
    if (!tasks.length) {
      return update.manualSteps.map((step) => ({
        step,
        key: null,
        done: false,
      }));
    }
    const target = await this.boardTarget(update.userId);
    return Promise.all(
      tasks.map(async (task) => ({
        step: task.step,
        key: task.key,
        done: await target.board.isClosed(task.id),
      })),
    );
  }

  /** Cada passo à mão vira uma sub-tarefa da atualização. */
  async createStepTasks(update: UpdateWithAccount, steps: string[]) {
    const target = await this.boardTarget(update.userId);
    if (!target || !update.boardTaskId) return;
    const created: StepTask[] = [];
    for (const step of steps) {
      const task = await target.board
        .createSubtask(target.projectId, update.boardTaskId, {
          title: `Passo à mão: ${step}`.slice(0, 250),
          description: `Antes de atualizar o ${updateLabel(update)} para a ${update.toVersion}:\n\n${step}\n\n_Marca como feito quando estiver tratado; o agente vê isto antes de atualizar._`,
          labels: ['update', normalizeText(appName(update))],
        })
        .catch((error: unknown) => {
          this.logger.warn(
            `Quadro de tarefas (sub-tarefa): ${error instanceof Error ? error.message : String(error)}`,
          );
          return null;
        });
      if (task) created.push({ ...task, step });
    }
    if (created.length) {
      const current = await this.prisma.appUpdate.findUnique({
        where: { id: update.id },
        select: { stepTasks: true },
      });
      await this.prisma.appUpdate.update({
        where: { id: update.id },
        data: {
          stepTasks: [
            ...((current?.stepTasks as unknown as StepTask[] | null) ?? []),
            ...created,
          ] as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  private async boardTarget(userId: string) {
    const project = await this.board.ensureUpdatesProject(userId);
    const setting = await readSetting(this.prisma, userId);
    return {
      board: updatesBoard(this.board, userId),
      projectId: project.id,
      modules: setting.boardModules,
    };
  }

  /** O registo da atualização: reescreve-o (ou cria-o) com o estado atual. */
  private async syncLog(update: UpdateWithAccount): Promise<UpdateWithAccount> {
    try {
      const serverId =
        update.serverConnectionId ?? update.account?.serverConnectionId;
      const server = serverId
        ? await this.prisma.serverConnection.findUnique({
            where: { id: serverId },
            select: { id: true, name: true },
          })
        : null;
      const doc = await this.docs.writeLog(
        update.userId,
        update.logDocId,
        {
          title: logTitle(update, server?.name ?? null),
          content: logContent(update, server?.name ?? null),
          summary: `O estudo, as decisões, os comandos e o resultado da atualização do ${updateLabel(update)} para a ${update.toVersion}.`,
          tags: ['atualização', normalizeText(appName(update))],
          links: [
            ...(update.accountId ? [targetLink(update)] : []),
            ...(server
              ? [
                  {
                    type: DocLinkType.SERVER,
                    targetId: server.id,
                    label: server.name,
                  },
                ]
              : []),
          ],
        },
        {
          kind: 'agent',
          key: await updatesAgentKey(this.prisma, update.userId),
        },
      );
      if (doc.id === update.logDocId) return update;
      await this.prisma.appUpdate.update({
        where: { id: update.id },
        data: { logDocId: doc.id },
      });
      return { ...update, logDocId: doc.id };
    } catch (error) {
      this.logger.warn(
        `Registo da atualização ${update.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return update;
    }
  }

  /** Cria a tarefa (nos módulos, com as datas e os links) e liga-a à da atualização anterior da mesma app. */
  private async createTask(update: UpdateWithAccount): Promise<string | null> {
    const target = await this.boardTarget(update.userId);
    if (!target) return null;
    try {
      const task = await target.board.createTask(target.projectId, {
        title: taskTitle(update),
        description: taskDescription(update),
        labels: [
          'update',
          normalizeText(appName(update)),
          ...(update.componentGroup
            ? [COMPONENT_LABELS[update.componentGroup] ?? 'peça']
            : []),
        ],
        status: BOARD_STATUS[update.status],
        modules: [...target.modules, appName(update)],
        updateId: update.id,
        ...taskDates(update),
      });
      await this.prisma.appUpdate.update({
        where: { id: update.id },
        data: {
          boardTaskId: task.id,
          boardTaskKey: task.key,
          boardError: null,
        },
      });
      await this.boardExtras(target, task.id, update);
      return task.id;
    } catch (error) {
      await this.boardFailed(update.id, error);
      return null;
    }
  }

  /** O que não é essencial à tarefa (links, relação, sub-tarefas): se falhar, fica só no log do servidor. */
  private async boardExtras(
    target: BoardTarget,
    taskId: string,
    update: UpdateWithAccount,
  ) {
    const quiet = (what: string) => (error: unknown) =>
      this.logger.warn(
        `Quadro de tarefas (${what}): ${error instanceof Error ? error.message : String(error)}`,
      );
    await target.board
      .addLinks(target.projectId, taskId, taskLinks(update))
      .catch(quiet('links'));
    if (update.manualSteps.length) {
      await this.createStepTasks(update, update.manualSteps);
    }
  }

  private async boardFailed(id: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Quadro de tarefas: ${message}`);
    await this.prisma.appUpdate.update({
      where: { id },
      data: { boardError: message.slice(0, 500) },
    });
  }
}
