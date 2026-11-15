import {
  getMessageOverview,
  listMessageIds,
  MessageOverview,
} from 'src/email-rule/google/gmail-api.client';
import { mapWithLimit } from 'src/utils/concurrency/mapWithLimit';
import {
  findRecurringSubjectPhrases,
  RecurringPhrase,
} from './findRecurringSubjectPhrases';

/** Quantos dias para trás se olha. */
export const ANALYSIS_DAYS = 30;
/** Quantos emails se leem no máximo — chega para ver padrões sem gastar a quota do Gmail. */
const MESSAGE_CAP = 300;
const SENDERS_KEPT = 40;
// O Gmail limita pedidos por minuto: poucos de cada vez, e o que falhar fica de fora.
const CONCURRENCY = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface UnlabeledSender {
  address: string;
  name: string;
  domain: string;
  emails: number;
  unread: number;
  bulk: number;
  inInbox: number;
  oldestInInboxDays: number | null;
  subjects: string[];
}

export interface UnlabeledSummary {
  read: number;
  unlabeled: number;
  skipped: number;
  senders: UnlabeledSender[];
  /** Expressões que se repetem nos assuntos — para regras por assunto ou palavra-chave. */
  subjectPhrases: RecurringPhrase[];
}

/** "Revolut <no-reply@revolut.com>" → nome, endereço e domínio. */
const parseFrom = (from: string) => {
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const address = (match?.[2] ?? from).trim().toLowerCase();
  return {
    address,
    name: (match?.[1] ?? '').trim() || address,
    domain: address.split('@')[1] ?? address,
  };
};

/**
 * Os emails dos últimos 30 dias que não têm nenhum marcador do utilizador — os
 * que nenhuma regra (nem ele à mão) organizou —, agrupados por remetente. É o
 * material de onde saem as regras propostas.
 */
export async function collectUnlabeledSenders(
  accessToken: string,
): Promise<UnlabeledSummary> {
  const ids = await listMessageIds(
    accessToken,
    `newer_than:${ANALYSIS_DAYS}d -in:spam -in:trash -in:sent -in:draft -in:chats`,
    MESSAGE_CAP,
  );
  const read = await mapWithLimit(ids, CONCURRENCY, (id) =>
    getMessageOverview(accessToken, id).catch(() => null),
  );
  const messages = read.filter(
    (message): message is MessageOverview => message !== null,
  );
  const unlabeled = messages.filter((message) => message.userLabels === 0);

  const now = Date.now();
  const senders = new Map<string, UnlabeledSender>();
  for (const message of unlabeled) {
    const { address, name, domain } = parseFrom(message.from);
    const sender = senders.get(address) ?? {
      address,
      name,
      domain,
      emails: 0,
      unread: 0,
      bulk: 0,
      inInbox: 0,
      oldestInInboxDays: null,
      subjects: [],
    };
    sender.emails++;
    if (message.unread) sender.unread++;
    if (message.isBulk) sender.bulk++;
    if (message.inInbox) {
      sender.inInbox++;
      const age = message.receivedAt
        ? Math.floor((now - message.receivedAt.getTime()) / DAY_MS)
        : null;
      if (
        age != null &&
        (sender.oldestInInboxDays == null || age > sender.oldestInInboxDays)
      ) {
        sender.oldestInInboxDays = age;
      }
    }
    if (sender.subjects.length < 5 && message.subject) {
      sender.subjects.push(message.subject.slice(0, 120));
    }
    senders.set(address, sender);
  }

  return {
    read: messages.length,
    unlabeled: unlabeled.length,
    skipped: ids.length - messages.length,
    senders: [...senders.values()]
      .sort((a, b) => b.emails - a.emails)
      .slice(0, SENDERS_KEPT),
    subjectPhrases: findRecurringSubjectPhrases(
      unlabeled.map((message) => ({
        subject: message.subject,
        sender: parseFrom(message.from).address,
      })),
    ),
  };
}
