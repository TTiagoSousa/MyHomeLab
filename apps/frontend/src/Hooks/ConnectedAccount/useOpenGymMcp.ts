import { useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import i18n from '../../i18n';
import { useAlert } from '../../Contexts/Alert_Context';

export const useOpenGymMcp = () => {
  const [saving, setSaving] = useState(false);
  const { setAlert } = useAlert();

  const saveToken = async (accountId: string, token: string) => {
    setSaving(true);
    try {
      const response = await http.put(End_Points.Connected_Account_OpenGym_Mcp_Endpoint(accountId), { token }, { withCredentials: true });
      setAlert({
        open: true,
        message: response.data.connected ? i18n.t('addons:apps.openGym.mcp.saved', { count: response.data.tools }) : i18n.t('addons:apps.openGym.mcp.removed'),
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

  return { saving, saveToken };
};
