import { useEffect, useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import i18n from '../../i18n';

export interface NginxProxyManagerStatus {
  profile: string;
  proxyHosts: number;
  redirectionHosts: number;
  deadHosts: number;
  streams: number;
  disabled: number;
  offline: number;
  certificates: number;
  expiringSoon: { name: string; expiresOn: string | null; days: number }[];
  version: string | null;
}

export const useNginxProxyManagerStatus = (accountId: string | undefined) => {
  const [status, setStatus] = useState<NginxProxyManagerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const response = await http.get(End_Points.Connected_Account_Nginx_Proxy_Manager_Status_Endpoint(accountId), { withCredentials: true });
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
