import { useEffect, useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import i18n from '../../i18n';

export interface NextcloudAppUpdate {
  id: string;
  name: string;
  installed: string;
  latest: string;
  releaseUrl: string;
}

export interface NextcloudStatus {
  login: string;
  displayName: string | null;
  isAdmin: boolean;
  maintenance: boolean;
  needsDbUpgrade: boolean;
  apps: number;
  appUpdates: NextcloudAppUpdate[];
  storeReachable: boolean;
  version: string | null;
  latestVersion: string | null;
  latestUrl: string | null;
}

export const useNextcloudStatus = (accountId: string | undefined) => {
  const [status, setStatus] = useState<NextcloudStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const response = await http.get(End_Points.Connected_Account_Nextcloud_Status_Endpoint(accountId), { withCredentials: true });
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
