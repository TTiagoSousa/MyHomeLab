import {
  ConditionLogic,
  EmailRule,
  EmailRuleLabelPath,
  LabelMode,
  MailKind,
  MatchType,
} from 'src/generated/prisma/client/client';

export type EmailRuleWithLabelPaths = EmailRule & {
  labelPaths: EmailRuleLabelPath[];
};

export interface EmailRuleLabelPathInput {
  path: string;
  labelMode?: LabelMode;
}

export interface EmailRuleFields {
  name: string;
  isActive: boolean;
  conditionLogic: ConditionLogic;
  fromContains: string[];
  subjectContains: string[];
  keywords: string[];
  excludeKeywords: string[];
  matchType: MatchType;
  hasAttachment: boolean | null;
  mailKind: MailKind;
  markAsRead: boolean;
  markAsImportant: boolean;
  markAsStarred: boolean;
  stopProcessing: boolean;
  removeFromInbox: boolean;
  removeFromInboxAfterDays: number | null;
  removeOnlyIfRead: boolean;
  markAsReadOnRemove: boolean;
  starredExpiresAfterDays: number | null;
  importantExpiresAfterDays: number | null;
  importantExpiresOnStar: boolean;
  labelPaths: EmailRuleLabelPathInput[];
}

export interface EmailRuleRepository {
  findById(id: string): Promise<EmailRuleWithLabelPaths | null>;
  findAllByAccount(accountId: string): Promise<EmailRuleWithLabelPaths[]>;
  countByAccount(accountId: string): Promise<number>;
  create(
    data: Partial<EmailRuleFields> & {
      name: string;
      accountId: string;
      order: number;
    },
  ): Promise<EmailRuleWithLabelPaths>;
  update(
    id: string,
    data: Partial<EmailRuleFields>,
  ): Promise<EmailRuleWithLabelPaths>;
  delete(id: string): Promise<void>;
  decrementOrderAfter(accountId: string, order: number): Promise<void>;
  reorder(accountId: string, orderedIds: string[]): Promise<void>;
}
