import { TodoStatus } from 'src/generated/prisma/client/client';

/** O estado novo e a data em que ficou feita (limpa quando volta a estar por fazer). */
export function statusChange(current: TodoStatus, next?: TodoStatus) {
  if (!next || next === current) return {};
  const finished = next === TodoStatus.DONE || next === TodoStatus.CANCELLED;
  return { status: next, completedAt: finished ? new Date() : null };
}
