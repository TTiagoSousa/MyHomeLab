import {
  RemoteTask,
  RemoteTaskInput,
  RemoteTaskList,
  TaskListNotFoundError,
} from '../remote/taskRemote';

import { GOOGLE_TIMEOUT_MS } from 'src/connected-account/google/google-oauth.client';

const GOOGLE_TASKS_API_BASE = 'https://tasks.googleapis.com/tasks/v1';

const tasksFetch = (url: string, init: RequestInit = {}) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS) });

export type GoogleTaskList = RemoteTaskList;
export type GoogleTaskInput = RemoteTaskInput;
export type GoogleTask = RemoteTask;

/** A lista deixou de existir no Google (foi apagada lá). */
export class GoogleTaskListNotFoundError extends TaskListNotFoundError {
  constructor(taskListId: string) {
    super(taskListId);
    this.message = `A lista ${taskListId} já não existe no Google Tasks`;
    this.name = 'GoogleTaskListNotFoundError';
  }
}

async function failure(response: Response, what: string): Promise<Error> {
  const body = await response.text().catch(() => '');
  // 403 com "accessNotConfigured": a API das tarefas não está ligada no projeto Google.
  const hint = body.includes('accessNotConfigured')
    ? ' — liga a Google Tasks API no projeto da Google Cloud'
    : '';
  return new Error(`${what}: ${response.status}${hint}`);
}

export async function listTaskLists(
  accessToken: string,
): Promise<GoogleTaskList[]> {
  const lists: GoogleTaskList[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ maxResults: '100' });
    if (pageToken) params.set('pageToken', pageToken);
    const response = await tasksFetch(
      `${GOOGLE_TASKS_API_BASE}/users/@me/lists?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok)
      throw await failure(response, 'Falha ao ler as listas do Google Tasks');
    const data = (await response.json()) as {
      items?: GoogleTaskList[];
      nextPageToken?: string;
    };
    for (const item of data.items ?? [])
      lists.push({ id: item.id, title: item.title });
    pageToken = data.nextPageToken;
  } while (pageToken);
  return lists;
}

export async function createTaskList(
  accessToken: string,
  title: string,
): Promise<GoogleTaskList> {
  const response = await tasksFetch(
    `${GOOGLE_TASKS_API_BASE}/users/@me/lists`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    },
  );
  if (!response.ok)
    throw await failure(response, 'Falha ao criar a lista no Google Tasks');
  const list = (await response.json()) as GoogleTaskList;
  return { id: list.id, title: list.title };
}

interface GoogleTaskResponse {
  id: string;
  title?: string;
  notes?: string;
  due?: string;
  status?: string;
  completed?: string;
  parent?: string;
  updated?: string;
  deleted?: boolean;
}

function toGoogleTask(raw: GoogleTaskResponse): GoogleTask {
  return {
    id: raw.id,
    title: raw.title ?? '',
    notes: raw.notes ?? null,
    dueDay: raw.due ? raw.due.slice(0, 10) : null,
    completed: raw.status === 'completed',
    completedAt: raw.completed ? new Date(raw.completed) : null,
    parent: raw.parent ?? null,
    updated: raw.updated ? new Date(raw.updated) : new Date(),
  };
}

// showHidden traz as concluídas que o Google esconde; as apagadas ficam de fora de
// propósito — desaparecer da listagem é o sinal de que foi apagada lá.
export async function listTasks(
  accessToken: string,
  taskListId: string,
): Promise<GoogleTask[]> {
  const tasks: GoogleTask[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      maxResults: '100',
      showCompleted: 'true',
      showHidden: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const response = await tasksFetch(
      `${GOOGLE_TASKS_API_BASE}/lists/${taskListId}/tasks?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (response.status === 404)
      throw new GoogleTaskListNotFoundError(taskListId);
    if (!response.ok)
      throw await failure(response, 'Falha ao ler as tarefas do Google Tasks');
    const data = (await response.json()) as {
      items?: GoogleTaskResponse[];
      nextPageToken?: string;
    };
    for (const item of data.items ?? [])
      if (!item.deleted) tasks.push(toGoogleTask(item));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return tasks;
}

// null (e não undefined) para o Google apagar as notas ou o prazo que lá estavam.
const toBody = (task: GoogleTaskInput) => ({
  title: task.title,
  notes: task.notes ?? null,
  due: task.dueDay ? `${task.dueDay}T00:00:00.000Z` : null,
  status: task.completed ? 'completed' : 'needsAction',
  ...(task.completed ? {} : { completed: null }),
});

// Devolvem a tarefa gravada (e não só o id): o `updated` que o Google acabou de pôr
// fica guardado, senão a corrida seguinte via a nossa própria escrita como uma
// mudança feita lá e devolvia-a em ping-pong.
export async function insertTask(
  accessToken: string,
  taskListId: string,
  task: GoogleTaskInput,
  parentId?: string,
): Promise<GoogleTask> {
  const params = new URLSearchParams();
  if (parentId) params.set('parent', parentId);
  const response = await tasksFetch(
    `${GOOGLE_TASKS_API_BASE}/lists/${taskListId}/tasks?${params.toString()}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(toBody(task)),
    },
  );
  if (!response.ok)
    throw await failure(response, 'Falha ao criar a tarefa no Google Tasks');
  return toGoogleTask((await response.json()) as GoogleTaskResponse);
}

export async function patchTask(
  accessToken: string,
  taskListId: string,
  taskId: string,
  task: GoogleTaskInput,
): Promise<GoogleTask> {
  const response = await tasksFetch(
    `${GOOGLE_TASKS_API_BASE}/lists/${taskListId}/tasks/${taskId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(toBody(task)),
    },
  );
  if (!response.ok)
    throw await failure(
      response,
      'Falha ao atualizar a tarefa no Google Tasks',
    );
  return toGoogleTask((await response.json()) as GoogleTaskResponse);
}

export async function deleteTask(
  accessToken: string,
  taskListId: string,
  taskId: string,
): Promise<void> {
  const response = await tasksFetch(
    `${GOOGLE_TASKS_API_BASE}/lists/${taskListId}/tasks/${taskId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok && response.status !== 404)
    throw await failure(response, 'Falha ao apagar a tarefa no Google Tasks');
}
