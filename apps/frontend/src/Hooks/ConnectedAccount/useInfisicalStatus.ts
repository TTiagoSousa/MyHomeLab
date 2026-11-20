import { useEffect, useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import i18n from '../../i18n';

export interface InfisicalStatus {
  clientId: string;
  projects: { id: string; name: string; environments: string[] }[];
  updateAvailable: string | null;
  version: string | null;
}

export const useInfisicalStatus = (accountId: string | undefined) => {
  const [status, setStatus] = useState<InfisicalStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const response = await http.get(End_Points.Connected_Account_Infisical_Status_Endpoint(accountId), { withCredentials: true });
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
