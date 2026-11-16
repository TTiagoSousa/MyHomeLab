import {
  getThreadMessages,
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

/** Arquiva as conversas que ficaram na caixa de entrada só por mensagens tuas. */
export async function archiveLeftoverThreads(
  accessToken: string,
  threadIds: string[],
  archivedIds: Set<string>,
  labelsToRemove: string[],
): Promise<number> {
  let archived = 0;
  for (const threadId of new Set(threadIds)) {
    const messages = await getThreadMessages(accessToken, threadId);
    if (!onlyYoursLeft(messages, archivedIds)) continue;
    await modifyThread(accessToken, threadId, {
      removeLabelIds: labelsToRemove,
    });
    archived += 1;
  }
  return archived;
}
