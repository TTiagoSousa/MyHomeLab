import { dateLocale } from '../../../i18n';
import { isOpenTodo, type Todo } from '../../../Hooks/Todos/todoTypes';

export const TODO_SECTIONS = ['overdue', 'today', 'tomorrow', 'week', 'later', 'noDate', 'done'] as const;

export type TodoSection = (typeof TODO_SECTIONS)[number];

const pad = (value: number) => String(value).padStart(2, '0');

export const localDayKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const addDays = (dayKey: string, days: number) => {
  const [year, month, day] = dayKey.split('-').map(Number);
  return localDayKey(new Date(year, month - 1, day + days));
};

export const todayKey = () => localDayKey(new Date());

export const dueDayKey = (todo: Pick<Todo, 'dueAt' | 'dueAllDay'>) => {
  if (!todo.dueAt) return null;
  return todo.dueAllDay ? todo.dueAt.slice(0, 10) : localDayKey(new Date(todo.dueAt));
};

export const dueTime = (todo: Pick<Todo, 'dueAt' | 'dueAllDay'>) => {
  if (!todo.dueAt || todo.dueAllDay) return '';
  const date = new Date(todo.dueAt);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const sectionOf = (todo: Todo, today = todayKey()): TodoSection => {
  if (!isOpenTodo(todo)) return 'done';
  const day = dueDayKey(todo);
  if (!day) return 'noDate';
  if (day < today) return 'overdue';
  if (day === today) return 'today';
  if (day === addDays(today, 1)) return 'tomorrow';
  if (day <= addDays(today, 7)) return 'week';
  return 'later';
};

export const isOverdue = (todo: Todo) => isOpenTodo(todo) && sectionOf(todo) === 'overdue';

export const dueToPayload = (date: string, time: string) => {
  if (!date) return { dueAt: null, dueAllDay: false };
  if (!time) return { dueAt: `${date}T00:00:00.000Z`, dueAllDay: true };
  return { dueAt: new Date(`${date}T${time}`).toISOString(), dueAllDay: false };
};

export const formatDay = (dayKey: string) => {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });
};
