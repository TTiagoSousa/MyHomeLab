import { dateLocale } from '../../../i18n';
import type { BoardTask, TaskPriority } from '../../../Hooks/Board/boardTypes';

export const formatDay = (date: string | null) =>
  date ? new Date(date).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }) : '';

export const formatDateTime = (date: string) =>
  new Date(date).toLocaleString(dateLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const toDayInput = (date: string | null) => (date ? date.slice(0, 10) : '');

export const fromDayInput = (value: string) => (value ? new Date(`${value}T09:00:00Z`).toISOString() : null);

export const isOverdue = (task: BoardTask) =>
  Boolean(task.dueDate && !task.completedAt && new Date(task.dueDate).getTime() < Date.now() - 86_400_000);

export const PRIORITY_RANK: Record<TaskPriority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3, NONE: 4 };

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('') || '?';
