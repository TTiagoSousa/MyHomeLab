import { useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import { useAlert } from "../../Contexts/Alert_Context";
import type { ConditionLogic, EmailRuleLabelPath, MailKind, MatchType } from "./useEmailRules";

export interface EmailRulePayload {
  name?: string;
  isActive?: boolean;

  conditionLogic?: ConditionLogic;
  fromContains?: string[];
  subjectContains?: string[];
  keywords?: string[];
  excludeKeywords?: string[];
  matchType?: MatchType;
  hasAttachment?: boolean;
  mailKind?: MailKind;

  markAsRead?: boolean;
  markAsImportant?: boolean;
  markAsStarred?: boolean;

  stopProcessing?: boolean;

  removeFromInbox?: boolean;
  removeFromInboxAfterDays?: number | null;
  removeOnlyIfRead?: boolean;
  markAsReadOnRemove?: boolean;

  starredExpiresAfterDays?: number | null;
  importantExpiresAfterDays?: number | null;
  importantExpiresOnStar?: boolean;

  labelPaths?: EmailRuleLabelPath[];
}

export type RunScope = 'INBOX' | 'ALL';

export interface RunEmailRulesResult {
  scope: RunScope;
  rulesEvaluated: number;
  messagesMatched: number;
  messagesModified: number;
  truncated: boolean;
  perRule: { ruleId: string; ruleName: string; matched: number; modified: number }[];
}

export const useEmailRule = (accountId: string) => {
  const [loading, setLoading] = useState(false);
  const { setAlert } = useAlert();

  const createEmailRule = async (data: EmailRulePayload) => {
    setLoading(true);
    try {
      await http.post(End_Points.Email_Rule_Endpoint(accountId), data, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('email:alerts.ruleCreated'), type: 'success' });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateEmailRule = async (id: string, data: Partial<EmailRulePayload>, silent = false) => {
    setLoading(true);
    try {
      await http.patch(End_Points.Email_Rule_By_Id_Endpoint(accountId, id), data, { withCredentials: true });
      if (!silent) {
        setAlert({ open: true, message: i18n.t('email:alerts.ruleUpdated'), type: 'success' });
      }
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteEmailRule = async (id: string) => {
    setLoading(true);
    try {
      await http.delete(End_Points.Email_Rule_By_Id_Endpoint(accountId, id), { withCredentials: true });
      setAlert({ open: true, message: i18n.t('email:alerts.ruleDeleted'), type: 'success' });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const reorderEmailRules = async (orderedIds: string[]) => {
    try {
      await http.patch(End_Points.Email_Rule_Reorder_Endpoint(accountId), { orderedIds }, { withCredentials: true });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    }
  };

  const runEmailRules = async (scope: RunScope) => {
    setLoading(true);
    try {
      const response = await http.post<RunEmailRulesResult>(
        End_Points.Email_Rule_Run_Endpoint(accountId),
        { scope },
        { withCredentials: true },
      );
      const result = response.data;
      setAlert({
        open: true,
        message: i18n.t('email:alerts.runResult', {
          rules: result.rulesEvaluated,
          matched: result.messagesMatched,
          modified: result.messagesModified,
          truncated: result.truncated ? i18n.t('email:alerts.runTruncated') : '',
        }),
        type: 'success',
      });
      return result;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createEmailRule, updateEmailRule, deleteEmailRule, reorderEmailRules, runEmailRules, loading };
};
