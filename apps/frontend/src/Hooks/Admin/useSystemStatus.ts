import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";

export interface SystemStatus {
  startedAt: string;
  uptimeSeconds: number;
  node: string;
  memoryMb: number;
  database: { ok: boolean; ms: number; error: string | null };
  jobs: { name: string; lastRun: string | null; nextRun: string | null }[];
  counts: { failedRuns: number; runningRuns: number; boardErrors: number; studyErrors: number; openNotifications: number };
  problems: { at: string; level: 'error' | 'warn'; context: string; message: string }[];
}

const REFRESH_MS = 30_000;

export const useSystemStatus = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    try {
      const response = await http.get(End_Points.System_Status_Endpoint(), { withCredentials: true });
      setStatus(response.data);
      setError('');
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || i18n.t('common:errors.generic'));
    }
  };

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  return { status, error, fetchStatus };
};
