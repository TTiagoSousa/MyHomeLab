import {
  Todo,
  TodoPriority,
  TodoStatus,
} from 'src/generated/prisma/client/client';
import { normalizeName } from 'src/todo/helpers/normalizeName';
import { AgentContext } from '../agents/agent-context';
import {
  failure,
  lisbonInstant,
  lisbonToday,
  TIME_ZONE,
} from 'src/utils/lisbonTime';

/** Quantas tarefas se mostram de uma vez. */
const MAX_TODOS = 80;

const PRIORITIES: Record<string, TodoPriority> = {
  alta: TodoPriority.HIGH,
  media: TodoPriority.MEDIUM,
  baixa: TodoPriority.LOW,
};

const PRIORITY_NAMES: Record<TodoPriority, string> = {
  HIGH: 'alta',
  MEDIUM: 'média',
  LOW: 'baixa',
};

const STATUSES: Record<string, TodoStatus> = {
  por_fazer: TodoStatus.OPEN,
  a_andar: TodoStatus.IN_PROGRESS,
  feita: TodoStatus.DONE,
  cancelada: TodoStatus.CANCELLED,
};

const STATUS_NAMES: Record<TodoStatus, string> = {
  OPEN: 'por fazer',
  IN_PROGRESS: 'a andar',
  DONE: 'feita',
  CANCELLED: 'cancelada',
};

const isOpen = (todo: Todo) =>
  todo.status === TodoStatus.OPEN || todo.status === TodoStatus.IN_PROGRESS;

/** O nome de quem escreve: o agente que está a correr, ou o Jarvis. */
const authorOf = (context: AgentContext) =>
  context.team.find((agent) => agent.key === context.agentKey)?.name ??
  'Jarvis';

/** O prazo: só o dia fica "o dia todo"; com hora, é essa hora em Portugal. */
function dueOf(date?: string, time?: string) {
  if (!date) return null;
  if (!time) {
    lisbonInstant(date);
    return {
      dueAt: new Date(`${date}T00:00:00Z`).toISOString(),
      dueAllDay: true,
    };
  }
  return { dueAt: lisbonInstant(date, time).toISOString(), dueAllDay: false };
}

const formatDue = (todo: Todo) => {
  if (!todo.dueAt) return null;
  return todo.dueAllDay
    ? todo.dueAt.toLocaleDateString('pt-PT', { timeZone: 'UTC' })
    : todo.dueAt.toLocaleString('pt-PT', {
        timeZone: TIME_ZONE,
        dateStyle: 'short',
        timeStyle: 'short',
      });
};

/** O dia do prazo em Portugal (AAAA-MM-DD), para comparar com hoje. */
const dueDay = (todo: Todo) =>
  !todo.dueAt
    ? null
    : todo.dueAllDay
      ? todo.dueAt.toISOString().slice(0, 10)
      : lisbonToday(todo.dueAt);

const describe = (todo: Todo, listName?: string) =>
  [
    `${isOpen(todo) ? '' : `[${STATUS_NAMES[todo.status]}] `}${todo.title}`,
    todo.status === TodoStatus.IN_PROGRESS ? 'a andar' : null,
    listName ? `lista ${listName}` : null,
    formatDue(todo) ? `prazo ${formatDue(todo)}` : null,
    todo.priority ? `prioridade ${PRIORITY_NAMES[todo.priority]}` : null,
    todo.parentId ? `sub-tarefa de ${todo.parentId}` : null,
    todo.notes ? `notas: ${todo.notes.slice(0, 160)}` : null,
    todo.links.length ? `links ${todo.links.join(' ')}` : null,
    `id ${todo.id}`,
  ]
    .filter(Boolean)
    .join(' · ');

async function findList(context: AgentContext, wanted: string) {
  const lists = await context.todos.lists(context.userId);
  const target = normalizeName(wanted);
  const list =
    lists.find((entry) => entry.id === wanted.trim()) ??
    lists.find((entry) => normalizeName(entry.name) === target) ??
    lists.find((entry) => normalizeName(entry.name).includes(target));
  return (
    list ??
    `Não encontrei a lista "${wanted}". As listas são: ${lists.map((entry) => entry.name).join(', ')}.`
  );
}

/** A tarefa pelo id, ou pelo título entre as por fazer (de uma lista, se dita). */
async function findTodo(
  context: AgentContext,
  wanted: string,
  listName?: string,
): Promise<Todo | string> {
  const all = await context.todos.list(context.userId);
  const byId = all.find((todo) => todo.id === wanted.trim());
  if (byId) return byId;

  let candidates = all.filter(isOpen);
  if (listName?.trim()) {
    const list = await findList(context, listName);
    if (typeof list === 'string') return list;
    candidates = candidates.filter((todo) => todo.listId === list.id);
  }
  const target = normalizeName(wanted);
  const exact = candidates.filter(
    (todo) => normalizeName(todo.title) === target,
  );
  const matches = exact.length
    ? exact
    : candidates.filter((todo) => normalizeName(todo.title).includes(target));
  if (matches.length === 1) return matches[0];
  if (!matches.length)
    return `Não encontrei nenhuma tarefa por fazer com "${wanted}".`;
  return `Há várias tarefas com "${wanted}"; diz qual pelo id: ${matches
    .map((todo) => `"${todo.title}" (id ${todo.id})`)
    .join('; ')}.`;
}

export async function todoLists(context: AgentContext): Promise<string> {
  try {
    const lists = await context.todos.lists(context.userId);
    return `Listas em Tarefas:\n${lists
      .map(
        (list) => `${list.name} (${list.openCount} por fazer) · id ${list.id}`,
      )
      .join('\n')}`;
  } catch (error) {
    return failure(error);
  }
}

export async function todoListTasks(
  context: AgentContext,
  input: {
    list?: string;
    include_done?: boolean;
    due?: 'overdue' | 'today' | 'week';
  },
): Promise<string> {
  try {
    const lists = await context.todos.lists(context.userId);
    const names = new Map(lists.map((list) => [list.id, list.name]));
    let listId: string | undefined;
    if (input.list?.trim()) {
      const list = await findList(context, input.list);
      if (typeof list === 'string') return list;
      listId = list.id;
    }
    const today = lisbonToday();
    const weekEnd = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const todos = (
      await context.todos.list(context.userId, {
        listId,
        status: input.include_done ? 'all' : 'open',
      })
    ).filter((todo) => {
      if (!input.due) return true;
      const day = dueDay(todo);
      if (!day) return false;
      if (input.due === 'overdue') return day < today;
      if (input.due === 'today') return day <= today;
      return day <= weekEnd;
    });
    if (!todos.length) return 'Não há tarefas que encaixem.';
    const shown = todos.slice(0, MAX_TODOS);
    return (
      `${todos.length} tarefa${todos.length === 1 ? '' : 's'} (hoje é ${today}):\n` +
      shown
        .map((todo) =>
          describe(todo, listId ? undefined : names.get(todo.listId)),
        )
        .join('\n') +
      (todos.length > shown.length
        ? `\n… e mais ${todos.length - shown.length}.`
        : '')
    );
  } catch (error) {
    return failure(error);
  }
}

export async function todoCreate(
  context: AgentContext,
  input: {
    list: string;
    title: string;
    notes?: string;
    due_date?: string;
    due_time?: string;
    priority?: string;
    links?: string[];
    parent?: string;
  },
): Promise<string> {
  try {
    if (!input.title?.trim()) return 'Falta o título da tarefa.';
    if (!input.list?.trim()) return 'Diz em que lista fica a tarefa.';
    const lists = await context.todos.lists(context.userId);
    const existed = lists.some(
      (list) => normalizeName(list.name) === normalizeName(input.list),
    );
    const list = await context.todos.ensureList(context.userId, input.list);
    const parent = input.parent ? await findTodo(context, input.parent) : null;
    if (typeof parent === 'string') return parent;
    const due = dueOf(input.due_date, input.due_time);
    const todo = await context.todos.create(
      context.userId,
      {
        listId: list.id,
        title: input.title,
        notes: input.notes,
        ...(due ?? {}),
        priority: input.priority
          ? PRIORITIES[normalizeName(input.priority)]
          : null,
        links: input.links,
        parentId: parent?.id,
      },
      authorOf(context),
    );
    return `Criada a tarefa "${todo.title}" na lista "${list.name}"${existed ? '' : ' (criei a lista)'}${formatDue(todo) ? ` com prazo ${formatDue(todo)}` : ''}. id ${todo.id}`;
  } catch (error) {
    return failure(error);
  }
}

export async function todoUpdate(
  context: AgentContext,
  input: {
    task: string;
    list?: string;
    title?: string;
    notes?: string;
    append_notes?: string;
    due_date?: string;
    due_time?: string;
    priority?: string;
    status?: string;
    move_to?: string;
    links?: string[];
    add_links?: string[];
  },
): Promise<string> {
  try {
    const todo = await findTodo(context, input.task, input.list);
    if (typeof todo === 'string') return todo;

    let listId: string | undefined;
    if (input.move_to?.trim()) {
      listId = (await context.todos.ensureList(context.userId, input.move_to))
        .id;
    }
    const status = input.status ? STATUSES[input.status] : undefined;
    if (input.status && !status) return `Estado desconhecido: ${input.status}.`;
    const due =
      input.due_date === undefined
        ? undefined
        : input.due_date === ''
          ? { dueAt: null, dueAllDay: false }
          : dueOf(input.due_date, input.due_time);
    const notes = input.append_notes?.trim()
      ? [todo.notes, input.append_notes.trim()].filter(Boolean).join('\n\n')
      : input.notes;
    const priority =
      input.priority === undefined
        ? undefined
        : (PRIORITIES[normalizeName(input.priority)] ?? null);

    const updated = await context.todos.update(context.userId, todo.id, {
      listId,
      title: input.title,
      notes,
      ...(due ?? {}),
      priority,
      status,
      links: input.add_links?.length
        ? [...todo.links, ...input.add_links]
        : input.links,
    });
    return `Atualizada: ${describe(updated)}`;
  } catch (error) {
    return failure(error);
  }
}

export async function todoDelete(
  context: AgentContext,
  input: { task: string; list?: string },
): Promise<string> {
  try {
    const todo = await findTodo(context, input.task, input.list);
    if (typeof todo === 'string') return todo;
    await context.todos.remove(context.userId, todo.id);
    return `Apagada a tarefa "${todo.title}".`;
  } catch (error) {
    return failure(error);
  }
}

export async function todoCreateList(
  context: AgentContext,
  input: { name: string },
): Promise<string> {
  try {
    if (!input.name?.trim()) return 'Falta o nome da lista.';
    const list = await context.todos.createList(context.userId, {
      name: input.name,
    });
    return `Criada a lista "${list.name}" em Tarefas. id ${list.id}`;
  } catch (error) {
    return failure(error);
  }
}
