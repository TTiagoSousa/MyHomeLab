import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";

export type AppUpdateStatus =
  | 'NEW'
  | 'STUDY'
  | 'STUDYING'
  | 'READY'
  | 'WAITING'
  | 'LATER'
  | 'IN_PROGRESS'
  | 'VERIFYING'
  | 'DONE'
  | 'CANCELLED'
  | 'FAILED';

export interface AccountUpdate {
  id: string;
  fromVersion: string;
  toVersion: string;
  releaseUrl: string | null;
  component: string | null;
  componentTitle: string | null;
  componentGroup: string | null;
  status: AppUpdateStatus;
  risk: string | null;
  summary: string | null;
  boardTaskKey: string | null;
  updateAfter: string | null;
  recheckAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const UPDATE_CLOSED: AppUpdateStatus[] = ['DONE', 'CANCELLED', 'FAILED'];

export const useAccountUpdates = (accountId?: string) => {
  const [updates, setUpdates] = useState<AccountUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchUpdates = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const response = await http.get(End_Points.Connected_Account_Updates_Endpoint(accountId), { withCredentials: true });
      setUpdates(response.data);
      setError('');
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdates();
  }, [accountId]);

  return { updates, loading, error, fetchUpdates };
};
