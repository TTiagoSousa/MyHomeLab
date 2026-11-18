import { useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import i18n from '../../i18n';
import { useAlert } from '../../Contexts/Alert_Context';

export interface CronJob {
  key: string;
  intervalMinutes: number;
  intervals: number[];
  options: Record<string, unknown> | null;
  lastDetail: Record<string, unknown> | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastOk: boolean | null;
  lastCount: number | null;
  lastError: string | null;
  running: boolean;
}

export type CronScope = { kind: 'account' | 'server'; id: string | undefined };

const endpoints = (scope: CronScope, id: string) =>
  scope.kind === 'server'
    ? {
        list: End_Points.Server_Cron_Jobs_Endpoint(id),
        job: (key: string) => End_Points.Server_Cron_Job_Endpoint(id, key),
        run: (key: string) => End_Points.Server_Cron_Job_Run_Endpoint(id, key),
      }
    : {
        list: End_Points.Cron_Jobs_Endpoint(id),
        job: (key: string) => End_Points.Cron_Job_Endpoint(id, key),
        run: (key: string) => End_Points.Cron_Job_Run_Endpoint(id, key),
      };

export const cronJobLabelKey = (key: string) => key.replace(/\./g, '_');

const errorMessage = (error: unknown) => {
  const failure = error as { response?: { data?: { message?: string } }; message?: string };
  return failure.response?.data?.message || failure.message || i18n.t('common:errors.generic');
};

export const useCronJobs = (scope: CronScope) => {
  const accountId = scope.id;
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const { setAlert } = useAlert();

  const replace = (job: CronJob) => setJobs((current) => current.map((entry) => (entry.key === job.key ? job : entry)));

  const fetchJobs = async () => {
    if (!accountId) return;
    try {
      const response = await http.get<CronJob[]>(endpoints(scope, accountId).list, { withCredentials: true });
      setJobs(response.data);
    } catch (error) {
      setAlert({ open: true, message: errorMessage(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const saveInterval = async (key: string, intervalMinutes: number, options?: Record<string, unknown>) => {
    if (!accountId) return false;
    setBusy(key);
    try {
      const response = await http.put<CronJob>(endpoints(scope, accountId).job(key), options ? { intervalMinutes, options } : { intervalMinutes }, { withCredentials: true });
      replace(response.data);
      setAlert({ open: true, message: i18n.t('addons:cronJobs.saved'), type: 'success' });
      return true;
    } catch (error) {
      setAlert({ open: true, message: errorMessage(error), type: 'error' });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const runNow = async (key: string) => {
    if (!accountId) return;
    setBusy(key);
    try {
      const response = await http.post<CronJob>(endpoints(scope, accountId).run(key), {}, { withCredentials: true });
      replace(response.data);
      const job = response.data;
      setAlert({
        open: true,
        message: job.lastOk
          ? i18n.t(`addons:cronJobs.jobs.${cronJobLabelKey(key)}.result`, { count: job.lastCount ?? 0 })
          : job.lastError || i18n.t('addons:cronJobs.failed'),
        type: job.lastOk ? 'success' : 'error',
      });
    } catch (error) {
      setAlert({ open: true, message: errorMessage(error), type: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return { jobs, loading, busy, fetchJobs, saveInterval, runNow };
};
