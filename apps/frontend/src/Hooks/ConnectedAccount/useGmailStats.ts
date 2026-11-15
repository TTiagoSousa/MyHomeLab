import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import { useAlert } from "../../Contexts/Alert_Context";

export interface GmailStats {
  inboxTotal: number;
  inboxUnread: number;
  inboxRead: number;
  mailboxTotal: number;
}

export const useGmailStats = (accountId: string | null) => {
  const [gmailStats, setGmailStats] = useState<GmailStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setAlert } = useAlert();

  const fetchGmailStats = async ({ notifyOnError = false } = {}) => {
    if (!accountId) return false;

    setLoading(true);
    try {
      const response = await http.get(End_Points.Connected_Account_Gmail_Stats_Endpoint(accountId), {
        withCredentials: true,
      });
      setGmailStats(response.data);
      setError('');
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setError(msg);
      if (notifyOnError) setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGmailStats();
  }, [accountId]);

  return { gmailStats, loading, error, fetchGmailStats };
};
