import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import type { EmailRulePayload } from "./useEmailRule";

export type ProposalStatus = 'PENDING' | 'DISMISSED' | 'IMPLEMENTED';

export interface ProposalEvidence {
  emails: number;
  unread: number;
  bulk: number;
  senders: string[];
}

export interface RuleProposal {
  id: string;
  rule: EmailRulePayload;
  reason: string;
  evidence: ProposalEvidence | null;
  status: ProposalStatus;
  userEdited: boolean;
  implementedRuleId: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  autoImplementAt: string | null;
}

const errorMessage = (error: any): string =>
  error?.response?.data?.message || error?.message || i18n.t('common:errors.generic');

export const useRuleProposals = (accountId: string | null) => {
  const [pending, setPending] = useState<RuleProposal[]>([]);
  const [recent, setRecent] = useState<RuleProposal[]>([]);
  const [lastAnalysisAt, setLastAnalysisAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const { setAlert } = useAlert();

  const fetchProposals = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const response = await http.get(End_Points.Rule_Proposals_Endpoint(accountId), { withCredentials: true });
      setPending(response.data.pending);
      setRecent(response.data.recent);
      setLastAnalysisAt(response.data.lastAnalysisAt);
    } catch {
      setPending([]);
      setRecent([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, [accountId]);

  const runAction = async (key: string, action: () => Promise<string>) => {
    setBusy(key);
    try {
      const message = await action();
      setAlert({ open: true, message, type: 'success' });
      await fetchProposals();
      return true;
    } catch (error: any) {
      setAlert({ open: true, message: errorMessage(error), type: 'error' });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const analyze = () =>
    runAction('analyze', async () => {
      const response = await http.post(End_Points.Rule_Proposals_Analyze_Endpoint(accountId!), {}, { withCredentials: true });
      const { created, updated, deleted, rejected, unlabeled, comment } = response.data;
      const summary = i18n.t('email:proposals.alerts.analyzed', { created, updated, deleted, rejected, unlabeled });
      return comment ? `${summary} ${comment}` : summary;
    });

  const implementAll = () =>
    runAction('implementAll', async () => {
      const response = await http.post(End_Points.Rule_Proposals_Implement_All_Endpoint(accountId!), {}, { withCredentials: true });
      return i18n.t('email:proposals.alerts.implementedAll', { count: response.data.implemented });
    });

  const implement = (id: string) =>
    runAction(id, async () => {
      await http.post(End_Points.Rule_Proposal_Implement_Endpoint(accountId!, id), {}, { withCredentials: true });
      return i18n.t('email:proposals.alerts.implemented');
    });

  const dismiss = (id: string) =>
    runAction(id, async () => {
      await http.post(End_Points.Rule_Proposal_Dismiss_Endpoint(accountId!, id), {}, { withCredentials: true });
      return i18n.t('email:proposals.alerts.dismissed');
    });

  const updateProposal = (id: string, payload: EmailRulePayload) =>
    runAction(id, async () => {
      await http.patch(End_Points.Rule_Proposal_By_Id_Endpoint(accountId!, id), payload, { withCredentials: true });
      return i18n.t('email:proposals.alerts.updated');
    });

  const restore = (id: string) =>
    runAction(id, async () => {
      await http.post(End_Points.Rule_Proposal_Restore_Endpoint(accountId!, id), {}, { withCredentials: true });
      return i18n.t('email:proposals.alerts.restored');
    });

  return { pending, recent, lastAnalysisAt, loading, busy, fetchProposals, analyze, implementAll, implement, dismiss, restore, updateProposal };
};
