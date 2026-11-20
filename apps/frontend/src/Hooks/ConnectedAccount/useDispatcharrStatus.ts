import { useEffect, useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import i18n from '../../i18n';

interface DispatcharrSource {
  id: number;
  name: string;
  status: string | null;
  active: boolean;
}

export interface DispatcharrStatus {
  profile: string;
  channels: number;
  streams: number;
  m3uAccounts: DispatcharrSource[];
  epgSources: DispatcharrSource[];
  liveChannels: number;
  clients: number;
  version: string | null;
}

export const useDispatcharrStatus = (accountId: string | undefined) => {
  const [status, setStatus] = useState<DispatcharrStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const response = await http.get(End_Points.Connected_Account_Dispatcharr_Status_Endpoint(accountId), { withCredentials: true });
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
