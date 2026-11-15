/** Uma lista de tarefas noutro sítio (Google Tasks, Nextcloud). */
export interface RemoteTaskList {
  id: string;
  title: string;
}

/** O que se escreve numa tarefa lá: o comum a todos (sem prioridade, links nem hora). */
export interface RemoteTaskInput {
  title: string;
  notes: string | null;
  /** O dia (AAAA-MM-DD). */
  dueDay: string | null;
  completed: boolean;
}

export interface RemoteTask {
  id: string;
  title: string;
  notes: string | null;
  dueDay: string | null;
  completed: boolean;
  completedAt: Date | null;
  parent: string | null;
  /** Quando mudou lá pela última vez (decide quem ganha). */
  updated: Date;
}

/**
 * As tarefas de uma conta ligada, seja qual for o fornecedor. As escritas devolvem a
 * tarefa gravada: o `updated` de lá fica guardado, senão a volta seguinte via a nossa
 * própria escrita como uma mudança feita lá e devolvia-a em ping-pong.
 */
export interface TaskRemote {
  listLists(): Promise<RemoteTaskList[]>;
  createList(title: string): Promise<RemoteTaskList>;
  /** As tarefas da lista, com as concluídas; as apagadas ficam de fora (é o sinal de que se apagaram lá). */
  listTasks(listId: string): Promise<RemoteTask[]>;
  insertTask(
    listId: string,
    task: RemoteTaskInput,
    parentId?: string,
  ): Promise<RemoteTask>;
  patchTask(
    listId: string,
    taskId: string,
    task: RemoteTaskInput,
  ): Promise<RemoteTask>;
  deleteTask(listId: string, taskId: string): Promise<void>;
}

/** A lista deixou de existir lá (foi apagada). */
export class TaskListNotFoundError extends Error {
  constructor(listId: string) {
    super(`A lista ${listId} já não existe lá`);
    this.name = 'TaskListNotFoundError';
  }
}
