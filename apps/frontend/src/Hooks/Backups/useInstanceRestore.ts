import { useEffect, useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import { backupErrorMessage } from './useBackupDestinations';

export type RestoreState = 'idle' | 'queued' | 'running' | 'success' | 'failed';

export interface RestoreStatus {
  state: RestoreState;
  step: string | null;
  message: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  backupCreatedAt: string | null;
  log: string[];
}

const POLL_MS = 2000;

export const useInstanceRestore = () => {
  const [status, setStatus] = useState<RestoreStatus | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [waiting, setWaiting] = useState(false);

  const fetchStatus = async () => {
    try {
      const response = await http.get(End_Points.Instance_Backup_Restore_Status_Endpoint(), { withCredentials: true });
      setStatus(response.data);
      setWaiting(false);
    } catch {
      setWaiting(true);
    }
  };

  const active = status?.state === 'queued' || status?.state === 'running';

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(fetchStatus, POLL_MS);
    return () => clearInterval(timer);
  }, [active]);

  const restore = async (file: File, password: string): Promise<string | null> => {
    setUploading(true);
    setProgress(0);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('password', password);
      const response = await http.post(End_Points.Instance_Backup_Restore_Endpoint(), form, {
        withCredentials: true,
        timeout: 0,
        onUploadProgress: (event) => setProgress(event.total ? Math.round((event.loaded / event.total) * 100) : 0),
      });
      setStatus(response.data);
      return null;
    } catch (error: any) {
      return backupErrorMessage(error);
    } finally {
      setUploading(false);
    }
  };

  return { status, uploading, progress, waiting, active, fetchStatus, restore };
};
