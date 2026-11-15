import { AppUpdate, AppUpdateStatus } from 'src/generated/prisma/client/client';

const { CANCELLED, DONE, IN_PROGRESS, VERIFYING, WAITING, FAILED } =
  AppUpdateStatus;

/**
 * O que o quadro pode mudar: a correr não se mexe; uma feita fica feita; uma em
 * Verifying só fecha (Done, Cancelled) ou espera por ele; e só volta a Verifying uma
 * que já foi instalada (verificação que não fechou).
 */
export function boardMoveAllowed(
  update: Pick<AppUpdate, 'status' | 'verifyStartedAt' | 'installStartedAt'>,
  wanted: AppUpdateStatus,
): boolean {
  if (update.status === IN_PROGRESS || update.status === DONE) return false;
  if (update.status === VERIFYING)
    return ([DONE, CANCELLED, WAITING] as AppUpdateStatus[]).includes(wanted);
  if (wanted === VERIFYING)
    return (
      ([WAITING, FAILED] as AppUpdateStatus[]).includes(update.status) &&
      Boolean(update.verifyStartedAt)
    );
  return true;
}
