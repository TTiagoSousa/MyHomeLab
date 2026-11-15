import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { PrismaEmailRuleRepository } from 'src/email-rule/repositories/prisma/prisma-email-rule-repository';
import { ensureFreshAccessToken } from 'src/connected-account/helpers/ensureFreshAccessToken';
import { findAllEmailRules } from 'src/email-rule/helpers/findAllEmailRules';
import {
  buildGmailQuery,
  getMailboxStats,
  getMessageOverview,
  listMessageIds,
  MessageOverview,
} from 'src/email-rule/google/gmail-api.client';
import { mapWithLimit } from 'src/utils/concurrency/mapWithLimit';
import { resolveAccount } from './manageEmailRules';

const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;
/** Quantos emails se leem no máximo: chega para ver padrões sem gastar a quota do Gmail. */
const MESSAGE_CAP = 300;
const RULE_MATCH_CAP = 500;
const SENDERS_SHOWN = 30;
// Cada messages.get gasta quota por segundo; poucos de cada vez evitam o 429.
const CONCURRENCY = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

interface SenderStats {
  address: string;
  name: string;
  total: number;
  unread: number;
  bulk: number;
  inInbox: number;
  oldestInInboxDays: number | null;
  subjects: string[];
  rules: Set<string>;
  uncovered: number;
}

/** "Revolut <no-reply@revolut.com>" → nome e endereço. */
const parseFrom = (from: string) => {
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const address = (match?.[2] ?? from).trim().toLowerCase();
  return { address, name: (match?.[1] ?? '').trim() || address };
};

const percent = (part: number, total: number) =>
  total ? `${Math.round((part / total) * 100)}%` : '0%';

/**
 * O retrato da caixa para o agente propor regras com base em factos: os
 * remetentes dos últimos N dias (quantos, por ler, publicidade, ainda na caixa
 * de entrada e há quanto tempo) e, para cada um, que regras já o apanham. Para
 * saber o que cada regra apanha usa-se a pesquisa do próprio Gmail com a
 * condição da regra — é o mesmo que o motor de regras faz.
 */
export async function analyzeInbox(
  accountEmail: string | undefined,
  days: number | undefined,
  connectedAccountRepository: PrismaConnectedAccountRepository,
  emailRuleRepository: PrismaEmailRuleRepository,
  userId: string,
): Promise<string> {
  const period = Math.min(
    Math.max(Math.round(days ?? DEFAULT_DAYS), 1),
    MAX_DAYS,
  );
  const account = await resolveAccount(
    accountEmail,
    connectedAccountRepository,
    userId,
  );
  const accessToken = await ensureFreshAccessToken(
    account.id,
    connectedAccountRepository,
  );

  const window = `newer_than:${period}d -in:spam -in:trash -in:sent -in:draft`;
  const [ids, rules, mailbox] = await Promise.all([
    listMessageIds(accessToken, window, MESSAGE_CAP),
    findAllEmailRules(account.id, emailRuleRepository),
    getMailboxStats(accessToken),
  ]);
  // O Gmail também limita por minuto: o que não se conseguir ler fica de fora e
  // diz-se quantos, em vez de deitar a análise toda fora.
  const read = await mapWithLimit(ids, CONCURRENCY, (id) =>
    getMessageOverview(accessToken, id).catch(() => null),
  );
  const messages = read.filter(
    (message): message is MessageOverview => message !== null,
  );
  const skipped = ids.length - messages.length;
  const byId = new Map(messages.map((message) => [message.id, message]));

  // Que regras apanham cada email, e quantos apanha cada regra no período.
  const coveredBy = new Map<string, string[]>();
  const ruleHits: { rule: (typeof rules)[number]; hits: number }[] = [];
  for (const rule of rules.filter((entry) => entry.isActive)) {
    const condition = buildGmailQuery(rule, 'ALL');
    if (!condition) {
      ruleHits.push({ rule, hits: 0 });
      continue;
    }
    const matched = await listMessageIds(
      accessToken,
      `${condition} ${window}`,
      RULE_MATCH_CAP,
    ).catch(() => [] as string[]);
    let hits = 0;
    for (const id of matched) {
      const message = byId.get(id);
      if (!message) continue;
      if (rule.mailKind === 'BULK' && !message.isBulk) continue;
      if (rule.mailKind === 'DIRECT' && message.isBulk) continue;
      coveredBy.set(id, [...(coveredBy.get(id) ?? []), rule.name]);
      hits++;
    }
    ruleHits.push({ rule, hits });
  }

  const now = Date.now();
  const senders = new Map<string, SenderStats>();
  for (const message of messages) {
    const { address, name } = parseFrom(message.from);
    const stats =
      senders.get(address) ??
      ({
        address,
        name,
        total: 0,
        unread: 0,
        bulk: 0,
        inInbox: 0,
        oldestInInboxDays: null,
        subjects: [],
        rules: new Set<string>(),
        uncovered: 0,
      } satisfies SenderStats);
    stats.total++;
    if (message.unread) stats.unread++;
    if (message.isBulk) stats.bulk++;
    if (message.inInbox) {
      stats.inInbox++;
      const age = message.receivedAt
        ? Math.floor((now - message.receivedAt.getTime()) / DAY_MS)
        : null;
      if (
        age != null &&
        (stats.oldestInInboxDays == null || age > stats.oldestInInboxDays)
      ) {
        stats.oldestInInboxDays = age;
      }
    }
    if (stats.subjects.length < 2 && message.subject)
      stats.subjects.push(message.subject);
    const covering = coveredBy.get(message.id);
    if (covering) covering.forEach((ruleName) => stats.rules.add(ruleName));
    else stats.uncovered++;
    senders.set(address, stats);
  }

  return formatReport(
    account.emailAddress ?? '',
    period,
    messages,
    ids.length >= MESSAGE_CAP,
    skipped,
    mailbox,
    senders,
    ruleHits,
    coveredBy,
  );
}

function formatReport(
  accountEmail: string,
  period: number,
  messages: MessageOverview[],
  truncated: boolean,
  skipped: number,
  mailbox: { inboxTotal: number; inboxUnread: number },
  senders: Map<string, SenderStats>,
  ruleHits: {
    rule: Awaited<ReturnType<typeof findAllEmailRules>>[number];
    hits: number;
  }[],
  coveredBy: Map<string, string[]>,
): string {
  const total = messages.length;
  const unread = messages.filter((message) => message.unread).length;
  const bulk = messages.filter((message) => message.isBulk).length;
  const uncovered = messages.filter(
    (message) => !coveredBy.has(message.id),
  ).length;

  const lines = [
    `Análise de ${accountEmail}, últimos ${period} dias${truncated ? ` (só os ${total} mais recentes)` : ''}:`,
    `${total} emails recebidos, ${unread} por ler (${percent(unread, total)}), ${bulk} de publicidade/newsletters (${percent(bulk, total)}), ${uncovered} sem nenhuma regra (${percent(uncovered, total)}).`,
    `Caixa de entrada agora: ${mailbox.inboxTotal} conversas, ${mailbox.inboxUnread} por ler.`,
    ...(skipped
      ? [
          `Atenção: ${skipped} emails não foram lidos (o Gmail limitou os pedidos) — os números são aproximados.`,
        ]
      : []),
    '',
    'Remetentes, do que manda mais para o que manda menos:',
  ];

  const ranked = [...senders.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, SENDERS_SHOWN);
  for (const sender of ranked) {
    const facts = [
      `${sender.total} emails`,
      `${sender.unread} por ler`,
      sender.bulk ? `${sender.bulk} publicidade` : 'nenhum de publicidade',
      sender.inInbox
        ? `${sender.inInbox} ainda na caixa de entrada${sender.oldestInInboxDays != null ? ` (o mais antigo há ${sender.oldestInInboxDays} dias)` : ''}`
        : 'nenhum na caixa de entrada',
    ];
    const rules = sender.rules.size
      ? `regras: ${[...sender.rules].join(', ')}${sender.uncovered ? ` (${sender.uncovered} escapam)` : ''}`
      : 'SEM REGRA';
    lines.push(
      `- ${sender.name} <${sender.address}>: ${facts.join(', ')}; ${rules}. Ex.: ${sender.subjects.map((subject) => `"${subject}"`).join(' / ')}`,
    );
  }
  if (senders.size > ranked.length) {
    lines.push(
      `(+${senders.size - ranked.length} remetentes com menos emails)`,
    );
  }

  lines.push('', 'As tuas regras neste período:');
  if (!ruleHits.length) lines.push('- não há regras ativas.');
  for (const { rule, hits } of ruleHits) {
    const cleanup = [
      rule.markAsRead && 'marca como lido',
      rule.removeFromInbox &&
        (rule.removeFromInboxAfterDays != null
          ? `arquiva ao fim de ${rule.removeFromInboxAfterDays} dias${rule.removeOnlyIfRead ? ' (só se lido)' : ''}`
          : 'arquiva logo'),
      rule.markAsReadOnRemove && 'marca como lido ao arquivar',
    ].filter(Boolean);
    lines.push(
      `- "${rule.name}": apanhou ${hits} emails; ${cleanup.length ? cleanup.join(', ') : 'não limpa nada (nem lido nem arquivo)'}${rule.labelPaths.length ? `; marcadores ${rule.labelPaths.map((label) => label.path).join(', ')}` : ''}.`,
    );
  }
  return lines.join('\n');
}
