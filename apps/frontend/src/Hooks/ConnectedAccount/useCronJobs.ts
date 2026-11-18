import { useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import i18n from '../../i18n';
import { useAlert } from '../../Contexts/Alert_Context';

export interface CronJob {
  key: string;
  intervalMinutes: number;
  intervals: number[];
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastOk: boolean | null;
  lastCount: number | null;
  lastError: string | null;
  running: boolean;
}

export const cronJobLabelKey = (key: string) => key.replace(/\./g, '_');

const errorMessage = (error: unknown) => {
  const failure = error as { response?: { data?: { message?: string } }; message?: string };
  return failure.response?.data?.message || failure.message || i18n.t('common:errors.generic');
};

export const useCronJobs = (accountId: string | undefined) => {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const { setAlert } = useAlert();

  const replace = (job: CronJob) => setJobs((current) => current.map((entry) => (entry.key === job.key ? job : entry)));

  const fetchJobs = async () => {
    if (!accountId) return;
    try {
      const response = await http.get<CronJob[]>(End_Points.Cron_Jobs_Endpoint(accountId), { withCredentials: true });
      setJobs(response.data);
    } catch (error) {
      setAlert({ open: true, message: errorMessage(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const saveInterval = async (key: string, intervalMinutes: number) => {
    if (!accountId) return false;
    setBusy(key);
    try {
      const response = await http.put<CronJob>(End_Points.Cron_Job_Endpoint(accountId, key), { intervalMinutes }, { withCredentials: true });
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
      const response = await http.post<CronJob>(End_Points.Cron_Job_Run_Endpoint(accountId, key), {}, { withCredentials: true });
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
