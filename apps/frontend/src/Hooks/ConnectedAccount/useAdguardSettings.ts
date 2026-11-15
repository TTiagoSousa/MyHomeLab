import { useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import i18n from '../../i18n';
import { useAlert } from '../../Contexts/Alert_Context';

export const useAdguardSettings = () => {
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { setAlert } = useAlert();

  const showError = (error: any) =>
    setAlert({ open: true, message: error.response?.data?.message || error.message || i18n.t('common:errors.generic'), type: 'error' });

  const saveSettings = async (accountId: string, filtersInterval: number) => {
    setSaving(true);
    try {
      await http.put(End_Points.Connected_Account_Adguard_Settings_Endpoint(accountId), { filtersInterval }, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('addons:apps.adguard.settings.saved'), type: 'success' });
      return true;
    } catch (error: any) {
      showError(error);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const refreshFilters = async (accountId: string) => {
    setRefreshing(true);
    try {
      const response = await http.post(End_Points.Connected_Account_Adguard_Refresh_Filters_Endpoint(accountId), {}, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('addons:apps.adguard.settings.refreshed', { count: response.data.updated }), type: 'success' });
      return true;
    } catch (error: any) {
      showError(error);
      return false;
    } finally {
      setRefreshing(false);
    }
  };

  return { saving, refreshing, saveSettings, refreshFilters };
};
