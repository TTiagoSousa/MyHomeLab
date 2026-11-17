import { useEffect, useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import i18n from '../../i18n';

export interface ImmichStatus {
  profile: string;
  isAdmin: boolean;
  permissions: string[] | null;
  photos: number;
  videos: number;
  diskUse: string;
  diskSize: string;
  diskPercent: number;
  failedJobs: number | null;
  pausedQueues: string[] | null;
  version: string | null;
  latestVersion: string | null;
  latestUrl: string | null;
}

export const useImmichStatus = (accountId: string | undefined) => {
  const [status, setStatus] = useState<ImmichStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const response = await http.get(End_Points.Connected_Account_Immich_Status_Endpoint(accountId), { withCredentials: true });
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
