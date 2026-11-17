import { useEffect, useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import { useAlert } from '../../Contexts/Alert_Context';
import i18n from '../../i18n';
import { backupErrorMessage } from './useBackupDestinations';

export interface InstanceBackupSettings {
  passwordSet: boolean;
  passwordUpdatedAt: string | null;
  restoreEnabled: boolean;
  localFolder: string;
}

const fileNameFrom = (disposition: string | undefined) =>
  /filename="([^"]+)"/.exec(disposition ?? '')?.[1] ?? 'myhomelab.mhlbackup';

const saveFile = (data: Blob, name: string) => {
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

export const useInstanceBackup = () => {
  const [settings, setSettings] = useState<InstanceBackupSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { setAlert } = useAlert();

  const fetchSettings = async () => {
    try {
      const response = await http.get(End_Points.Instance_Backup_Endpoint(), { withCredentials: true });
      setSettings(response.data);
    } catch {
      setSettings(null);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const savePassword = async (password: string): Promise<string | null> => {
    setSaving(true);
    try {
      const response = await http.put(End_Points.Instance_Backup_Password_Endpoint(), { password }, { withCredentials: true });
      setSettings(response.data);
      setAlert({ open: true, message: i18n.t('admin:backup.password.saved'), type: 'success' });
      return null;
    } catch (error: any) {
      return backupErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      const response = await http.post(End_Points.Instance_Backup_Download_Endpoint(), {}, { withCredentials: true, responseType: 'blob' });
      saveFile(response.data, fileNameFrom(response.headers['content-disposition']));
      setAlert({ open: true, message: i18n.t('admin:backup.downloaded'), type: 'success' });
    } catch (error: any) {
      let message = backupErrorMessage(error);
      if (error.response?.data instanceof Blob) {
        try {
          message = JSON.parse(await error.response.data.text()).message ?? message;
        } catch {
          message = i18n.t('common:errors.generic');
        }
      }
      setAlert({ open: true, message, type: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  return { settings, saving, downloading, fetchSettings, savePassword, download };
};
