import { BoardService } from 'src/board/board.service';

/** As colunas por que passa a tarefa de uma atualização (as chaves das colunas do projeto). */
export type BoardStatus =
  | 'new'
  | 'study'
  | 'studying'
  | 'studied'
  | 'ready'
  | 'waiting'
  | 'later'
  | 'in_progress'
  | 'verifying'
  | 'done'
  | 'failed'
  | 'cancelled';

export interface BoardLink {
  title: string;
  url: string;
}

export interface BoardTaskInput {
  title: string;
  /** Markdown. */
  description: string;
  labels: string[];
  status: BoardStatus;
  startDate?: string | null;
  targetDate?: string | null;
  /** Os módulos onde a tarefa entra; criam-se se faltarem. */
  modules?: string[];
  parentId?: string;
  updateId?: string;
}

export type BoardTaskUpdate = Partial<
  Pick<
    BoardTaskInput,
    'title' | 'description' | 'status' | 'startDate' | 'targetDate'
  >
>;

const date = (value: string | null | undefined) =>
  value === undefined
    ? undefined
    : value
      ? new Date(`${value}T09:00:00Z`)
      : null;

/**
 * O quadro das atualizações: o projeto "Atualizações" do utilizador em Projetos.
 * O MyHomeLab mexe nas tarefas como "MyHomeLab" (o histórico da tarefa mostra-o).
 */
export function updatesBoard(board: BoardService, userId: string) {
  const actor = 'MyHomeLab';
  return {
    async createTask(projectId: string, input: BoardTaskInput) {
      const task = await board.createTask(
        userId,
        {
          projectId,
          title: input.title,
          description: input.description,
          labels: input.labels,
          stateKey: input.status,
          moduleNames: input.modules,
          startDate: date(input.startDate),
          dueDate: date(input.targetDate),
          parentId: input.parentId ?? null,
          updateId: input.updateId ?? null,
          assignee: await board.updatesAgentKey(userId),
        },
        actor,
      );
      return { id: task.id, key: task.key };
    },
    async updateTask(
      _projectId: string,
      taskId: string,
      input: BoardTaskUpdate,
    ) {
      const current = await board.task(userId, taskId).catch(() => null);
      if (!current) return;
      // "Estudo feito" fica no histórico entre o estudo e a decisão.
      if (
        current.state.key === 'studying' &&
        input.status &&
        ['ready', 'waiting', 'later'].includes(input.status)
      ) {
        await board.updateTask(userId, taskId, { stateKey: 'studied' }, actor);
      }
      await board.updateTask(
        userId,
        taskId,
        {
          title: input.title,
          description: input.description,
          stateKey: input.status,
          startDate: date(input.startDate),
          dueDate: date(input.targetDate),
        },
        actor,
      );
    },
    async comment(_projectId: string, taskId: string, markdown: string) {
      await board.comment(userId, taskId, markdown, actor);
    },
    async addLinks(_projectId: string, taskId: string, links: BoardLink[]) {
      for (const link of links) {
        await board.addLink(userId, taskId, link, actor);
      }
    },
    async addToModules(_projectId: string, taskId: string, names: string[]) {
      const current = await board.task(userId, taskId);
      await board.updateTask(
        userId,
        taskId,
        {
          moduleNames: [...current.modules.map((item) => item.name), ...names],
        },
        actor,
      );
    },
    async createSubtask(
      projectId: string,
      parentId: string,
      input: { title: string; description: string; labels: string[] },
    ) {
      const task = await board.createTask(
        userId,
        { projectId, parentId, ...input, stateKey: 'new', assignee: 'user' },
        actor,
      );
      return { id: task.id, key: task.key };
    },
    async isClosed(taskId: string) {
      const task = await board.task(userId, taskId).catch(() => null);
      return task
        ? ['COMPLETED', 'CANCELLED'].includes(task.state.group)
        : false;
    },
  };
}

export type UpdatesBoard = ReturnType<typeof updatesBoard>;
