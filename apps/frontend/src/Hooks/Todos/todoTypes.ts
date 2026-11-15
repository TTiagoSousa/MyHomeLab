export type TodoStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

export type TodoPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export const TODO_STATUSES: TodoStatus[] = ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'];

export const TODO_PRIORITIES: TodoPriority[] = ['HIGH', 'MEDIUM', 'LOW'];

export const TODO_VIEWS = ['all', 'today', 'week'] as const;

export type TodoView = (typeof TODO_VIEWS)[number];

export interface TodoList {
  id: string;
  name: string;
  color: string | null;
  position: number;
  openCount: number;
}

export interface Todo {
  id: string;
  listId: string;
  parentId: string | null;
  title: string;
  notes: string | null;
  dueAt: string | null;
  dueAllDay: boolean;
  priority: TodoPriority | null;
  status: TodoStatus;
  completedAt: string | null;
  links: string[];
  agentName: string | null;
  subject: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TodoPayload {
  listId?: string;
  parentId?: string | null;
  title?: string;
  notes?: string | null;
  dueAt?: string | null;
  dueAllDay?: boolean;
  priority?: TodoPriority | null;
  status?: TodoStatus;
  links?: string[];
}

export const isOpenTodo = (todo: Todo) => todo.status === 'OPEN' || todo.status === 'IN_PROGRESS';
