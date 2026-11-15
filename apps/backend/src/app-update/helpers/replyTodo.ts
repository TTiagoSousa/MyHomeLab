import { AppUpdateStatus } from 'src/generated/prisma/client/client';

/** A tarefa "Responder: …" das atualizações antigas (as perguntas novas já não a criam: só fecha). */
export const replyTodoSubject = (updateId: string) =>
  `update-waiting:${updateId}`;

const STATUS_TEXT: Record<AppUpdateStatus, string> = {
  NEW: 'disponível',
  STUDY: 'Espera por estudo',
  STUDYING: 'em estudo',
  READY: 'Ready to update',
  WAITING: 'Waiting for reply',
  LATER: 'Recheck later',
  IN_PROGRESS: 'a instalar',
  VERIFYING: 'a verificar',
  DONE: 'feita',
  CANCELLED: 'cancelada',
  FAILED: 'falhada',
};

export const answeredNote = (status: AppUpdateStatus) =>
  `Respondida: a atualização passou a ${STATUS_TEXT[status]}.`;
