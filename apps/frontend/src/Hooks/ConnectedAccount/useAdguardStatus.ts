import { useEffect, useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import i18n from '../../i18n';

export interface AdguardStatus {
  running: boolean;
  protectionEnabled: boolean;
  queries: number;
  blocked: number;
  filters: number;
  enabledFilters: number;
  rules: number;
  allowlists: number;
  userRules: number;
  rewrites: number;
  filtersInterval: number;
  filtersUpdatedAt: string | null;
  version: string | null;
  latestVersion: string | null;
  latestUrl: string | null;
}

export const useAdguardStatus = (accountId: string | undefined) => {
  const [status, setStatus] = useState<AdguardStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const response = await http.get(End_Points.Connected_Account_Adguard_Status_Endpoint(accountId), { withCredentials: true });
      setStatus(response.data);
      setError('');
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [accountId]);

  return { status, loading, error, fetchStatus };
};
