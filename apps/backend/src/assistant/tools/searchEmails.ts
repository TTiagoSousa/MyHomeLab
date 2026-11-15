import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { ensureFreshAccessToken } from 'src/connected-account/helpers/ensureFreshAccessToken';
import {
  listMessageIds,
  getMessageSnippet,
} from 'src/email-rule/google/gmail-api.client';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { mapWithLimit } from 'src/utils/concurrency/mapWithLimit';

const DEFAULT_MAX_RESULTS = 25;
const HARD_CAP = 50;

// Cada messages.get gasta quota do Gmail, contada por segundo. Pedir os 50 de uma
// vez estoirava o limite e devolvia 429; assim vão poucos de cada vez.
const CONCURRENCY = 5;

export async function searchEmails(
  accountEmail: string | undefined,
  query: string,
  maxResults: number | undefined,
  connectedAccountRepository: PrismaConnectedAccountRepository,
  userId: string,
): Promise<string> {
  const accounts = (
    await connectedAccountRepository.findAllActiveByUser(userId)
  ).filter(
    (account) =>
      account.provider === ConnectionProvider.GMAIL &&
      (!accountEmail || account.emailAddress === accountEmail),
  );

  if (accounts.length === 0) {
    return accountEmail
      ? `Não encontrei nenhuma conta Gmail ligada com o email ${accountEmail}.`
      : 'Não há nenhuma conta Gmail ligada.';
  }

  const cap = Math.min(maxResults ?? DEFAULT_MAX_RESULTS, HARD_CAP);
  const results: string[] = [];

  for (const account of accounts) {
    const accessToken = await ensureFreshAccessToken(
      account.id,
      connectedAccountRepository,
    );
    const messageIds = await listMessageIds(accessToken, query, cap);

    if (messageIds.length === 0) {
      results.push(
        `${account.emailAddress}: nenhum email encontrado para esta pesquisa.`,
      );
      continue;
    }

    const messages = await mapWithLimit(messageIds, CONCURRENCY, (id) =>
      getMessageSnippet(accessToken, id),
    );

    const listing = messages
      .map(
        (message, index) =>
          `${index + 1}. messageId: ${messageIds[index]}\nDe: ${message.from}\nAssunto: ${message.subject}\nPrévia: ${message.snippet}`,
      )
      .join('\n\n');

    results.push(
      `${account.emailAddress} (${messages.length} resultado(s)):\n${listing}`,
    );
  }

  return results.join('\n\n');
}
