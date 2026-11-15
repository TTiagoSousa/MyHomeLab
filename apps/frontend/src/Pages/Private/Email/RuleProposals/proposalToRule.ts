import type { EmailRule } from '../../../../Hooks/EmailRule/useEmailRules';
import type { RuleProposal } from '../../../../Hooks/EmailRule/useRuleProposals';

export const proposalToRule = (proposal: RuleProposal, accountId: string): EmailRule => {
  const rule = proposal.rule;
  return {
    id: proposal.id,
    accountId,
    name: rule.name ?? '',
    isActive: true,
    order: 0,
    conditionLogic: rule.conditionLogic ?? 'ALL',
    fromContains: rule.fromContains ?? [],
    subjectContains: rule.subjectContains ?? [],
    keywords: rule.keywords ?? [],
    excludeKeywords: rule.excludeKeywords ?? [],
    matchType: rule.matchType ?? 'CONTAINS',
    hasAttachment: rule.hasAttachment ?? null,
    mailKind: rule.mailKind ?? 'ANY',
    markAsRead: rule.markAsRead ?? false,
    markAsImportant: rule.markAsImportant ?? false,
    markAsStarred: rule.markAsStarred ?? false,
    stopProcessing: rule.stopProcessing ?? false,
    removeFromInbox: rule.removeFromInbox ?? false,
    removeFromInboxAfterDays: rule.removeFromInboxAfterDays ?? null,
    removeOnlyIfRead: rule.removeOnlyIfRead ?? false,
    markAsReadOnRemove: rule.markAsReadOnRemove ?? false,
    starredExpiresAfterDays: rule.starredExpiresAfterDays ?? null,
    importantExpiresAfterDays: rule.importantExpiresAfterDays ?? null,
    importantExpiresOnStar: rule.importantExpiresOnStar ?? false,
    labelPaths: (rule.labelPaths ?? []).map((entry) => ({ path: entry.path, labelMode: entry.labelMode ?? 'ALL_LEVELS' })),
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
  };
};
