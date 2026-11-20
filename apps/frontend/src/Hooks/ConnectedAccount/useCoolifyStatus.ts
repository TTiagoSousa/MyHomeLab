import { useEffect, useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import i18n from '../../i18n';

export interface CoolifyStatus {
  team: string | null;
  servers: number;
  unreachable: string[];
  projects: number;
  resources: { applications: number; services: number; databases: number };
  unhealthy: { name: string; status: string }[];
  mcp: number | null;
  version: string | null;
}

export const useCoolifyStatus = (accountId: string | undefined) => {
  const [status, setStatus] = useState<CoolifyStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const response = await http.get(End_Points.Connected_Account_Coolify_Status_Endpoint(accountId), { withCredentials: true });
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
