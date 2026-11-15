import { Prisma, Todo, TodoStatus } from 'src/generated/prisma/client/client';
import { RemoteTask, RemoteTaskInput } from '../remote/taskRemote';

const lisbonDay = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(date);

/** O dia do prazo: o próprio dia (dia inteiro) ou o dia em Portugal do instante. */
export const todoDueDay = (todo: Pick<Todo, 'dueAt' | 'dueAllDay'>) => {
  if (!todo.dueAt) return null;
  return todo.dueAllDay
    ? todo.dueAt.toISOString().slice(0, 10)
    : lisbonDay(todo.dueAt);
};

const isClosed = (status: TodoStatus) =>
  status === TodoStatus.DONE || status === TodoStatus.CANCELLED;

/** Uma tarefa daqui como fica lá (sem prioridade, links nem hora). */
export function todoToRemote(todo: Todo): RemoteTaskInput {
  return {
    title: todo.title,
    notes: todo.notes,
    dueDay: todoDueDay(todo),
    completed: isClosed(todo.status),
  };
}

/**
 * O que muda numa tarefa daqui com a de lá. O que lá não há fica como
 * estava: a prioridade, os links, a hora do prazo (se o dia for o mesmo), "a andar"
 * (por fazer lá) e "cancelada" (feita lá).
 */
export function remoteToTodo(
  task: RemoteTask,
  current?: Todo,
): Pick<
  Prisma.TodoUncheckedCreateInput,
  'title' | 'notes' | 'dueAt' | 'dueAllDay' | 'status' | 'completedAt'
> {
  const sameDay = current && todoDueDay(current) === task.dueDay;
  const due = !task.dueDay
    ? { dueAt: null, dueAllDay: false }
    : sameDay
      ? { dueAt: current.dueAt, dueAllDay: current.dueAllDay }
      : { dueAt: new Date(`${task.dueDay}T00:00:00.000Z`), dueAllDay: true };

  let status: TodoStatus;
  if (task.completed)
    status =
      current?.status === TodoStatus.CANCELLED
        ? TodoStatus.CANCELLED
        : TodoStatus.DONE;
  else
    status =
      current?.status === TodoStatus.IN_PROGRESS
        ? TodoStatus.IN_PROGRESS
        : TodoStatus.OPEN;

  return {
    title: task.title.trim().slice(0, 300) || '(sem título)',
    notes: task.notes?.trim() ? task.notes : null,
    ...due,
    status,
    completedAt: isClosed(status)
      ? (current?.completedAt ?? task.completedAt ?? new Date())
      : null,
  };
}
