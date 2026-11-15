import { useEffect, useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import { useAlert } from '../../Contexts/Alert_Context';
import i18n from '../../i18n';
import type { BackupJob, BackupJobPayload, BackupRunResult } from './backupTypes';
import { backupErrorMessage } from './useBackupDestinations';

export const useBackupJobs = (accountId: string) => {
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const { setAlert } = useAlert();

  const fetchJobs = async () => {
    try {
      const response = await http.get(End_Points.Backup_Jobs_Endpoint(), {
        params: { accountId },
        withCredentials: true,
      });
      setJobs(response.data);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [accountId]);

  const saveJob = async (payload: BackupJobPayload, id?: string): Promise<string | null> => {
    setSaving(true);
    try {
      if (id) {
        await http.patch(End_Points.Backup_Job_By_Id_Endpoint(id), payload, { withCredentials: true });
      } else {
        await http.post(End_Points.Backup_Jobs_Endpoint(), { ...payload, accountId }, { withCredentials: true });
      }
      await fetchJobs();
      setAlert({ open: true, message: i18n.t('servers:backups.saved'), type: 'success' });
      return null;
    } catch (error: any) {
      return backupErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const removeJob = async (id: string) => {
    try {
      await http.delete(End_Points.Backup_Job_By_Id_Endpoint(id), { withCredentials: true });
      await fetchJobs();
    } catch (error: any) {
      setAlert({ open: true, message: backupErrorMessage(error), type: 'error' });
    }
  };

  const runJob = async (id: string) => {
    setRunningId(id);
    try {
      const response = await http.post(End_Points.Backup_Job_Run_Endpoint(id), {}, { withCredentials: true });
      const result: BackupRunResult = response.data;
      setAlert(
        result.ok
          ? { open: true, message: i18n.t('servers:backups.done', { file: result.fileName }), type: 'success' }
          : { open: true, message: result.error ?? i18n.t('common:errors.generic'), type: 'error' },
      );
      await fetchJobs();
    } catch (error: any) {
      setAlert({ open: true, message: backupErrorMessage(error), type: 'error' });
    } finally {
      setRunningId(null);
    }
  };

  return { jobs, loading, saving, runningId, fetchJobs, saveJob, removeJob, runJob };
};
