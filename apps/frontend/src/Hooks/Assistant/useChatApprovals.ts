import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { docErrorMessage } from "../Docs/docErrorMessage";
import type { ChatApproval } from "./chatApprovalTypes";

export const useChatApprovals = (conversationId?: string | null) => {
  const [approvals, setApprovals] = useState<ChatApproval[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { setAlert } = useAlert();

  const fetchApprovals = async () => {
    if (!conversationId) {
      setApprovals([]);
      return;
    }
    try {
      const response = await http.get(End_Points.Chat_Approvals_Endpoint(conversationId), { withCredentials: true });
      setApprovals(response.data);
    } catch {
      setApprovals([]);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [conversationId]);

  const approveApproval = async (id: string) => {
    setBusyId(id);
    try {
      const response = await http.post(End_Points.Chat_Approval_Approve_Endpoint(id), {}, { withCredentials: true });
      const done: ChatApproval = response.data;
      await fetchApprovals();
      if (done.status === 'FAILED') {
        setAlert({ open: true, message: i18n.t('assistant:approvals.failed', { reason: done.result ?? '' }), type: 'error' });
      } else {
        setAlert({ open: true, message: i18n.t(`assistant:approvals.done.${done.kind}`), type: 'success' });
      }
    } catch (error: any) {
      setAlert({ open: true, message: docErrorMessage(error), type: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const rejectApproval = async (id: string) => {
    setBusyId(id);
    try {
      await http.post(End_Points.Chat_Approval_Reject_Endpoint(id), {}, { withCredentials: true });
      await fetchApprovals();
      setAlert({ open: true, message: i18n.t('assistant:approvals.rejected'), type: 'success' });
    } catch (error: any) {
      setAlert({ open: true, message: docErrorMessage(error), type: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  return { approvals, busyId, fetchApprovals, approveApproval, rejectApproval };
};
