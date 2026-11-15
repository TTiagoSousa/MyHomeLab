import type { AiClient } from 'src/ai-credential/ai-client';
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { ensureFreshAccessToken } from 'src/connected-account/helpers/ensureFreshAccessToken';
import {
  listMessageIds,
  getMessageSnippet,
} from 'src/email-rule/google/gmail-api.client';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { SUBAGENT_MODEL } from '../claude-agent.client';
import { mapWithLimit } from 'src/utils/concurrency/mapWithLimit';

const MAX_MESSAGES = 40;

// Ver a nota em searchEmails: o Gmail conta quota por segundo e uma rajada de
// 40 pedidos devolve 429.
const CONCURRENCY = 5;

const SUMMARY_SYSTEM_PROMPT =
  'Resumes emails para uma mensagem de chat. Português europeu, direto, sem markdown ' +
  '(sem #, **, listas com - ou *). Frases curtas separadas por linha em vez de marcadores. ' +
  'Destaca claramente no início se algo parece urgente ou importante, senão diz que não há nada de especial.';

function todayGmailQuery(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `in:inbox after:${year}/${month}/${day}`;
}

export async function summarizeEmailsToday(
  accountEmail: string | undefined,
  connectedAccountRepository: PrismaConnectedAccountRepository,
  userId: string,
  client: AiClient,
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

  const summaries: string[] = [];

  for (const account of accounts) {
    const accessToken = await ensureFreshAccessToken(
      account.id,
      connectedAccountRepository,
    );
    const messageIds = await listMessageIds(
      accessToken,
      todayGmailQuery(),
      MAX_MESSAGES,
    );

    if (messageIds.length === 0) {
      summaries.push(`${account.emailAddress}: sem emails novos hoje.`);
      continue;
    }

    const messages = await mapWithLimit(messageIds, CONCURRENCY, (id) =>
      getMessageSnippet(accessToken, id),
    );

    const emailsText = messages
      .map(
        (message, index) =>
          `${index + 1}. De: ${message.from}\nAssunto: ${message.subject}\nPrévia: ${message.snippet}`,
      )
      .join('\n\n');

    const response = await client.messages.create({
      // Resumir é execução pura — não precisa do Opus.
      model: SUBAGENT_MODEL,
      // Eram 500, e num dia com muitos emails o resumo saía cortado a meio de
      // uma frase, sem erro nenhum. Só se paga o que sai, portanto um teto
      // folgado não custa nada nos dias calmos.
      max_tokens: 2000,
      output_config: { effort: 'low' },
      cache_control: { type: 'ephemeral' },
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Resume estes ${messages.length} emails de hoje da conta ${account.emailAddress}:\n\n${emailsText}`,
        },
      ],
    });

    const text = response.content
      .filter((block): block is TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    summaries.push(`${account.emailAddress}:\n${text}`);
  }

  return summaries.join('\n\n');
}
