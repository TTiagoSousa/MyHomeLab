import {
  getThreadMessages,
  listMessageRefs,
  modifyThread,
  ThreadMessage,
} from '../google/gmail-api.client';

/**
 * Uma conversa só fica na caixa de entrada pelo que lá resta depois de a regra arquivar as
 * mensagens dela. Se o que resta são só mensagens tuas (respostas, reencaminhamentos), a
 * conversa sai inteira. Se alguém te respondeu, fica — essa resposta ainda é para ler.
 */
export function onlyYoursLeft(
  messages: ThreadMessage[],
  archivedIds: Set<string>,
): boolean {
  const left = messages.filter(
    (message) =>
      !archivedIds.has(message.id) && message.labelIds.includes('INBOX'),
  );
  return (
    left.length > 0 &&
    left.every((message) => message.labelIds.includes('SENT'))
  );
}

const OWN_INBOX_CAP = 500;

/** As conversas onde há uma mensagem tua na caixa de entrada — as que podem estar presas. */
export async function listOwnInboxThreads(
  accessToken: string,
): Promise<Set<string>> {
  const refs = await listMessageRefs(
    accessToken,
    'in:inbox from:me',
    OWN_INBOX_CAP,
  );
  return new Set(refs.map((ref) => ref.threadId));
}

/** Arquiva as conversas que ficaram na caixa de entrada só por mensagens tuas. */
export async function archiveLeftoverThreads(
  accessToken: string,
  threadIds: string[],
  archivedIds: Set<string>,
  labelsToRemove: string[],
): Promise<string[]> {
  const released: string[] = [];
  for (const threadId of new Set(threadIds)) {
    const messages = await getThreadMessages(accessToken, threadId);
    if (!onlyYoursLeft(messages, archivedIds)) continue;
    await modifyThread(accessToken, threadId, {
      removeLabelIds: labelsToRemove,
    });
    released.push(threadId);
  }
  return released;
}
