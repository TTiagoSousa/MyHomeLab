import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { docErrorMessage } from "./docErrorMessage";
import type { Doc, DocProposal } from "./docTypes";

export const useDocProposals = () => {
  const [proposals, setProposals] = useState<DocProposal[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { setAlert } = useAlert();

  const fetchProposals = async () => {
    try {
      const response = await http.get(End_Points.Doc_Proposals_Endpoint(), { withCredentials: true });
      setProposals(response.data);
    } catch {
      setProposals([]);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const approveProposal = async (id: string, content?: string): Promise<Doc | null> => {
    setBusyId(id);
    try {
      const response = await http.post(
        End_Points.Doc_Proposal_Approve_Endpoint(id),
        content === undefined ? {} : { content },
        { withCredentials: true },
      );
      await fetchProposals();
      setAlert({ open: true, message: i18n.t('docs:alerts.proposalApproved'), type: 'success' });
      return response.data;
    } catch (error: any) {
      setAlert({ open: true, message: docErrorMessage(error), type: 'error' });
      return null;
    } finally {
      setBusyId(null);
    }
  };

  const rejectProposal = async (id: string) => {
    setBusyId(id);
    try {
      await http.post(End_Points.Doc_Proposal_Reject_Endpoint(id), {}, { withCredentials: true });
      await fetchProposals();
      setAlert({ open: true, message: i18n.t('docs:alerts.proposalRejected'), type: 'success' });
      return true;
    } catch (error: any) {
      setAlert({ open: true, message: docErrorMessage(error), type: 'error' });
      return false;
    } finally {
      setBusyId(null);
    }
  };

  return { proposals, busyId, fetchProposals, approveProposal, rejectProposal };
};
