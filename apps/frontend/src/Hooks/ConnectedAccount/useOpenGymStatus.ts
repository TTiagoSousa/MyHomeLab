import { useEffect, useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import i18n from '../../i18n';

export interface OpenGymStatus {
  profile: string;
  isAdmin: boolean;
  writable: boolean;
  users: number | null;
  routines: number;
  workouts: number;
  lastWorkout: string | null;
  plannedDays: number;
  tokenExpiresAt: string | null;
  version: string | null;
  latestVersion: string | null;
  latestUrl: string | null;
}

export const useOpenGymStatus = (accountId: string | undefined) => {
  const [status, setStatus] = useState<OpenGymStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const response = await http.get(End_Points.Connected_Account_OpenGym_Status_Endpoint(accountId), { withCredentials: true });
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
