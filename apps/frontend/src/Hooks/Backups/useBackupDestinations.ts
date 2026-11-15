import { useEffect, useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import { useAlert } from '../../Contexts/Alert_Context';
import i18n from '../../i18n';
import type {
  BackupDestination,
  BackupDestinationCheck,
  BackupDestinationPayload,
} from './backupTypes';

const DESTINATIONS_CHANGED = 'myhomelab:backup-destinations-changed';

export const backupErrorMessage = (error: any): string => {
  const data = error?.response?.data;
  const message = Array.isArray(data?.message) ? data.message.join(' ') : data?.message;
  return message || error?.message || i18n.t('common:errors.generic');
};

export const useBackupDestinations = () => {
  const [destinations, setDestinations] = useState<BackupDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { setAlert } = useAlert();

  const fetchDestinations = async () => {
    try {
      const response = await http.get(End_Points.Backup_Destinations_Endpoint(), { withCredentials: true });
      setDestinations(response.data);
    } catch {
      setDestinations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDestinations();

    window.addEventListener(DESTINATIONS_CHANGED, fetchDestinations);
    return () => window.removeEventListener(DESTINATIONS_CHANGED, fetchDestinations);
  }, []);

  const saveDestination = async (payload: BackupDestinationPayload, id?: string): Promise<string | null> => {
    setSaving(true);
    try {
      const body = { ...payload, password: payload.password || undefined };
      if (id) {
        await http.patch(End_Points.Backup_Destination_By_Id_Endpoint(id), body, { withCredentials: true });
      } else {
        await http.post(End_Points.Backup_Destinations_Endpoint(), body, { withCredentials: true });
      }
      window.dispatchEvent(new Event(DESTINATIONS_CHANGED));
      setAlert({ open: true, message: i18n.t('addons:backups.saved'), type: 'success' });
      return null;
    } catch (error: any) {
      return backupErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const removeDestination = async (id: string) => {
    try {
      await http.delete(End_Points.Backup_Destination_By_Id_Endpoint(id), { withCredentials: true });
      window.dispatchEvent(new Event(DESTINATIONS_CHANGED));
      setAlert({ open: true, message: i18n.t('addons:backups.removed'), type: 'success' });
    } catch (error: any) {
      setAlert({ open: true, message: backupErrorMessage(error), type: 'error' });
    }
  };

  const checkDestination = async (id: string): Promise<BackupDestinationCheck> => {
    try {
      const response = await http.get(End_Points.Backup_Destination_Check_Endpoint(id), { withCredentials: true });
      return response.data;
    } catch (error: any) {
      return { ok: false, error: backupErrorMessage(error) };
    }
  };

  return { destinations, loading, saving, fetchDestinations, saveDestination, removeDestination, checkDestination };
};
