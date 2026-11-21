import { PrismaEmailRuleRepository } from '../repositories/prisma/prisma-email-rule-repository';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { ensureFreshAccessToken } from 'src/connected-account/helpers/ensureFreshAccessToken';
import {
  buildGmailQuery,
  getMessageHeaders,
  listMessageIds,
  listMessageRefs,
  loadLabelCache,
  modifyMessage,
  resolveLabelIds,
  MessageHeaders,
} from '../google/gmail-api.client';
import { mapWithLimit } from 'src/utils/concurrency/mapWithLimit';
import {
  archiveLeftoverThreads,
  listOwnInboxThreads,
} from './archiveLeftoverThreads';
import { RunScope } from '../dto/run-email-rule.dto';
import { EmailRuleWithLabelPaths } from '../repositories/email-rule-repository';
import { isSafePattern, MAX_INPUT_LENGTH } from './assertSafePatterns';

const MAX_MESSAGES_PER_RULE = 200;

// Ler cabeçalhos é um pedido ao Gmail por email, e a quota conta-se por segundo.
const HEADER_CONCURRENCY = 5;

interface RuleRunResult {
  ruleId: string;
  ruleName: string;
  matched: number;
  modified: number;
}

export interface RunEmailRulesResult {
  scope: RunScope;
  rulesEvaluated: number;
  messagesMatched: number;
  messagesModified: number;
  truncated: boolean;
  perRule: RuleRunResult[];
}

function safeRegexTest(pattern: string, input: string): boolean {
  if (!isSafePattern(pattern)) return false;
  try {
    return new RegExp(pattern).test(input.slice(0, MAX_INPUT_LENGTH));
  } catch {
    return false;
  }
}

/**
 * O cabeçalho From vem como `"Xbox Support" <xboxsupport3@microsoftsupport.com>`. Comparar
 * o valor da regra com o cabeçalho inteiro nunca batia com um endereço simples — e era
 * isso que se escrevia. Agora o exato aceita o endereço, o nome ou o cabeçalho completo,
 * sem distinguir maiúsculas.
 */
function fromMatchesExactly(value: string, from: string): boolean {
  const expected = value.trim().toLowerCase();
  const address = /<([^>]+)>/.exec(from)?.[1] ?? from;
  const name = from.replace(/<[^>]*>/, '').replace(/"/g, '');
  return [from, address, name].some(
    (candidate) => candidate.trim().toLowerCase() === expected,
  );
}

function matchesPrecisely(
  rule: EmailRuleWithLabelPaths,
  headers: MessageHeaders,
): boolean {
  // O tipo de envio é um filtro à parte: vale sempre, seja a lógica ALL ou ANY.
  if (rule.mailKind === 'BULK' && !headers.isBulk) return false;
  if (rule.mailKind === 'DIRECT' && headers.isBulk) return false;
  if (rule.matchType === 'CONTAINS') return true;

  const checks: boolean[] = [];

  if (rule.fromContains.length > 0) {
    checks.push(
      rule.matchType === 'EXACT'
        ? rule.fromContains.some((value) =>
            fromMatchesExactly(value, headers.from),
          )
        : rule.fromContains.some((value) => safeRegexTest(value, headers.from)),
    );
  }

  if (rule.subjectContains.length > 0) {
    checks.push(
      rule.matchType === 'EXACT'
        ? rule.subjectContains.some((value) => headers.subject === value)
        : rule.subjectContains.some((value) =>
            safeRegexTest(value, headers.subject),
          ),
    );
  }

  if (checks.length === 0) return true;
  return rule.conditionLogic === 'ANY'
    ? checks.some(Boolean)
    : checks.every(Boolean);
}

async function filterPreciseMatches(
  rule: EmailRuleWithLabelPaths,
  accessToken: string,
  candidateIds: string[],
): Promise<string[]> {
  // O Gmail não pesquisa por "cancelar a subscrição", por isso o tipo de envio
  // obriga a ler os cabeçalhos — tal como EXACT/REGEX. Sem nenhum dos dois, a
  // pesquisa do Gmail já chegou.
  if (rule.matchType === 'CONTAINS' && rule.mailKind === 'ANY') {
    return candidateIds;
  }

  const verdicts = await mapWithLimit(
    candidateIds,
    HEADER_CONCURRENCY,
    async (messageId) =>
      matchesPrecisely(rule, await getMessageHeaders(accessToken, messageId)),
  );
  return candidateIds.filter((_, index) => verdicts[index]);
}

// Ações de "manutenção" (remover da inbox após X dias, expirar estrela/importante) reavaliam o
// Gmail a cada execução em vez de dependerem de estado guardado — cada mensagem que ainda cumprir
// a condição (ex: "older_than:7d") é apanhada na próxima corrida, agendada ou manual.
async function sweepRemoveLabel(
  accessToken: string,
  rule: EmailRuleWithLabelPaths,
  extraQuery: string,
  labelsToRemove: string[],
  ownInboxThreads?: Set<string>,
): Promise<number> {
  const query = `${buildGmailQuery(rule, 'ALL')} ${extraQuery}`.trim();
  const candidates = await listMessageRefs(
    accessToken,
    query,
    MAX_MESSAGES_PER_RULE,
  );
  const matchedIds = await filterPreciseMatches(
    rule,
    accessToken,
    candidates.map((candidate) => candidate.id),
  );

  for (const messageId of matchedIds) {
    await modifyMessage(accessToken, messageId, {
      removeLabelIds: labelsToRemove,
    });
  }

  // O Gmail mostra a conversa na caixa de entrada enquanto uma mensagem dela lá estiver:
  // arquivar só as do remetente deixava lá as conversas em que respondeste ou reencaminhaste.
  if (labelsToRemove.includes('INBOX') && ownInboxThreads) {
    const archived = new Set(matchedIds);
    const threadIds = candidates
      .filter((candidate) => archived.has(candidate.id))
      .map((candidate) => candidate.threadId);

    // As que ficaram presas em execuções anteriores: o email da regra já foi arquivado,
    // por isso a pesquisa com in:inbox já não o vê — procura-se nas conversas onde ainda
    // há uma mensagem tua na caixa de entrada.
    if (ownInboxThreads.size > 0) {
      const archivedQuery =
        `${buildGmailQuery(rule, 'ALL')} ${extraQuery.replace('in:inbox', '-in:inbox')}`.trim();
      const stuck = (
        await listMessageRefs(accessToken, archivedQuery, MAX_MESSAGES_PER_RULE)
      ).filter((ref) => ownInboxThreads.has(ref.threadId));
      const stuckIds = await filterPreciseMatches(
        rule,
        accessToken,
        stuck.map((ref) => ref.id),
      );
      for (const ref of stuck) {
        if (!stuckIds.includes(ref.id)) continue;
        archived.add(ref.id);
        threadIds.push(ref.threadId);
      }
    }

    const released = await archiveLeftoverThreads(
      accessToken,
      threadIds,
      archived,
      labelsToRemove,
    );
    for (const threadId of released) ownInboxThreads.delete(threadId);
  }

  return matchedIds.length;
}

export async function runEmailRules(
  accountId: string,
  scope: RunScope,
  emailRuleRepository: PrismaEmailRuleRepository,
  connectedAccountRepository: PrismaConnectedAccountRepository,
): Promise<RunEmailRulesResult> {
  const accessToken = await ensureFreshAccessToken(
    accountId,
    connectedAccountRepository,
  );
  const allRules = await emailRuleRepository.findAllByAccount(accountId);
  const activeRules = allRules.filter((rule) => rule.isActive);

  const labelCache = await loadLabelCache(accessToken);
  const haltedMessageIds = new Set<string>();
  const ownInboxThreads = activeRules.some((rule) => rule.removeFromInbox)
    ? await listOwnInboxThreads(accessToken)
    : new Set<string>();

  let messagesMatched = 0;
  let messagesModified = 0;
  let truncated = false;
  const perRule: RuleRunResult[] = [];

  for (const rule of activeRules) {
    const query = buildGmailQuery(rule, scope);
    const candidateIds = await listMessageIds(
      accessToken,
      query,
      MAX_MESSAGES_PER_RULE,
    );
    if (candidateIds.length >= MAX_MESSAGES_PER_RULE) truncated = true;

    let ruleMatched = 0;
    let ruleModified = 0;

    const matchedIds = await filterPreciseMatches(
      rule,
      accessToken,
      candidateIds,
    );

    for (const messageId of matchedIds) {
      if (haltedMessageIds.has(messageId)) continue;

      ruleMatched += 1;
      messagesMatched += 1;

      const addLabelIds: string[] = [];
      const removeLabelIds: string[] = [];

      if (rule.markAsRead) removeLabelIds.push('UNREAD');
      if (rule.markAsImportant) addLabelIds.push('IMPORTANT');
      if (rule.markAsStarred) addLabelIds.push('STARRED');

      for (const entry of rule.labelPaths) {
        const ids = await resolveLabelIds(
          accessToken,
          entry.path,
          entry.labelMode,
          labelCache,
        );
        addLabelIds.push(...ids);
      }

      if (addLabelIds.length > 0 || removeLabelIds.length > 0) {
        await modifyMessage(accessToken, messageId, {
          addLabelIds,
          removeLabelIds,
        });
        ruleModified += 1;
        messagesModified += 1;
      }

      if (rule.stopProcessing) haltedMessageIds.add(messageId);
    }

    // --- Ações de manutenção: independentes da passagem imediata acima ---

    if (rule.removeFromInbox) {
      let extra = 'in:inbox';
      if (rule.removeFromInboxAfterDays != null) {
        extra += ` older_than:${rule.removeFromInboxAfterDays}d`;
      }
      if (rule.removeOnlyIfRead) extra += ' is:read';

      // Arquivar e marcar como lido são a mesma modificação na mensagem, por isso
      // vão na mesma chamada em vez de uma segunda passagem pelo Gmail.
      const labelsToRemove = rule.markAsReadOnRemove
        ? ['INBOX', 'UNREAD']
        : ['INBOX'];

      const removedCount = await sweepRemoveLabel(
        accessToken,
        rule,
        extra,
        labelsToRemove,
        ownInboxThreads,
      );
      ruleModified += removedCount;
      messagesModified += removedCount;
    }

    if (rule.starredExpiresAfterDays != null) {
      const removedCount = await sweepRemoveLabel(
        accessToken,
        rule,
        `is:starred older_than:${rule.starredExpiresAfterDays}d`,
        ['STARRED'],
      );
      ruleModified += removedCount;
      messagesModified += removedCount;
    }

    if (rule.importantExpiresAfterDays != null) {
      const removedCount = await sweepRemoveLabel(
        accessToken,
        rule,
        `is:important older_than:${rule.importantExpiresAfterDays}d`,
        ['IMPORTANT'],
      );
      ruleModified += removedCount;
      messagesModified += removedCount;
    }

    if (rule.importantExpiresOnStar) {
      const removedCount = await sweepRemoveLabel(
        accessToken,
        rule,
        'is:important is:starred',
        ['IMPORTANT'],
      );
      ruleModified += removedCount;
      messagesModified += removedCount;
    }

    perRule.push({
      ruleId: rule.id,
      ruleName: rule.name,
      matched: ruleMatched,
      modified: ruleModified,
    });
  }

  await connectedAccountRepository.update(accountId, { lastRunAt: new Date() });

  return {
    scope,
    rulesEvaluated: activeRules.length,
    messagesMatched,
    messagesModified,
    truncated,
    perRule,
  };
}
