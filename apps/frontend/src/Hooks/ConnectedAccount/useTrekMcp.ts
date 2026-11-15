import { useEffect, useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import i18n from '../../i18n';
import { useAlert } from '../../Contexts/Alert_Context';

export interface TrekTool {
  name: string;
  title: string | null;
  description: string;
  readOnly: boolean;
  destructive: boolean;
}

export const useTrekTools = (accountId: string | undefined) => {
  const [connected, setConnected] = useState(false);
  const [tools, setTools] = useState<TrekTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTools = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const response = await http.get(End_Points.Connected_Account_Trek_Tools_Endpoint(accountId), { withCredentials: true });
      setConnected(response.data.connected);
      setTools(response.data.tools);
      setError('');
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, [accountId]);

  return { connected, tools, loading, error, fetchTools };
};

export const useTrekMcpClient = () => {
  const [saving, setSaving] = useState(false);
  const { setAlert } = useAlert();

  const saveClient = async (accountId: string, clientId: string, clientSecret: string) => {
    setSaving(true);
    try {
      const response = await http.put(End_Points.Connected_Account_Trek_Mcp_Endpoint(accountId), { clientId, clientSecret }, { withCredentials: true });
      setAlert({
        open: true,
        message: response.data.connected ? i18n.t('addons:apps.trek.mcp.saved', { count: response.data.tools }) : i18n.t('addons:apps.trek.mcp.removed'),
        type: 'success',
      });
      return true;
    } catch (error: any) {
      setAlert({ open: true, message: error.response?.data?.message || error.message || i18n.t('common:errors.generic'), type: 'error' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { saving, saveClient };
};
