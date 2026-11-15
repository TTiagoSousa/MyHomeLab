import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";

export type ConditionLogic = 'ALL' | 'ANY';
export type MatchType = 'CONTAINS' | 'EXACT' | 'REGEX';
export type MailKind = 'ANY' | 'BULK' | 'DIRECT';
export type LabelMode = 'LEAF_ONLY' | 'ALL_LEVELS';

export interface EmailRuleLabelPath {
  path: string;
  labelMode: LabelMode;
}

export interface EmailRule {
  id: string;
  accountId: string;
  name: string;
  isActive: boolean;
  order: number;

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

  labelPaths: EmailRuleLabelPath[];

  createdAt: string;
  updatedAt: string;
}

export const useEmailRules = (accountId: string | null) => {
  const [emailRules, setEmailRules] = useState<EmailRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchEmailRules = async () => {
    if (!accountId) return;

    setLoading(true);
    try {
      const response = await http.get(End_Points.Email_Rule_Endpoint(accountId), {
        withCredentials: true,
      });
      setEmailRules(response.data);
      setError('');
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmailRules();
  }, [accountId]);

  return { emailRules, loading, error, fetchEmailRules };
};
