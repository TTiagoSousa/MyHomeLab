import {
  Notification,
  NotificationKind,
} from 'src/generated/prisma/client/client';

const WAITING_PREFIX = 'update-waiting:';

/** A atualização de uma pergunta ("update-waiting:<atualização>:<tarefa>"). */
export const waitingUpdateId = (subject: string | null): string | null =>
  subject?.startsWith(WAITING_PREFIX)
    ? subject.slice(WAITING_PREFIX.length).split(':')[0] || null
    : null;

export interface UpdateTarget {
  id: string;
  accountId: string | null;
  hostServerId: string | null;
}

type Foldable = Pick<
  Notification,
  'id' | 'kind' | 'subject' | 'connectedAccountId' | 'serverConnectionId'
>;

/**
 * A pergunta de uma atualização leva consigo o aviso "tem atualização" da mesma app
 * ou servidor (fica em `related`): é o mesmo assunto, não precisa de dois cartões.
 * Quando a pergunta fecha, o aviso volta a aparecer sozinho.
 */
export function foldUpdateNotices<T extends Foldable>(
  active: T[],
  targets: UpdateTarget[],
): (T & { related: T[] })[] {
  const folded = new Set<string>();
  const related = new Map<string, T[]>();
  for (const notification of active) {
    const target = targets.find(
      (item) => item.id === waitingUpdateId(notification.subject),
    );
    if (!target) continue;
    const same = active.filter(
      (other) =>
        other.kind === NotificationKind.APP_UPDATE &&
        !folded.has(other.id) &&
        ((target.accountId !== null &&
          other.connectedAccountId === target.accountId) ||
          (target.hostServerId !== null &&
            other.serverConnectionId === target.hostServerId)),
    );
    same.forEach((other) => folded.add(other.id));
    related.set(notification.id, same);
  }
  return active
    .filter((notification) => !folded.has(notification.id))
    .map((notification) => ({
      ...notification,
      related: related.get(notification.id) ?? [],
    }));
}
