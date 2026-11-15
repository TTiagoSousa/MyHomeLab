import { useEffect, useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import i18n from '../../i18n';

export type HomeAssistantUpdateGroup = 'system' | 'addons' | 'hacs' | 'firmware' | 'other';

export interface HomeAssistantUpdate {
  entityId: string;
  group: HomeAssistantUpdateGroup;
  title: string;
  installed: string | null;
  latest: string | null;
  pending: boolean;
  inProgress: boolean;
  autoUpdate: boolean;
  releaseUrl: string | null;
  releaseSummary: string | null;
}

export interface HomeAssistantStatus {
  locationName: string | null;
  user: string;
  isAdmin: boolean;
  entities: number;
  areas: number;
  devices: number;
  automations: number;
  scripts: number;
  scenes: number;
  pendingUpdates: number;
  updates: HomeAssistantUpdate[];
  version: string | null;
  latestVersion: string | null;
  latestUrl: string | null;
}

export const useHomeAssistantStatus = (accountId: string | undefined) => {
  const [status, setStatus] = useState<HomeAssistantStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const response = await http.get(End_Points.Connected_Account_Home_Assistant_Status_Endpoint(accountId), { withCredentials: true });
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
