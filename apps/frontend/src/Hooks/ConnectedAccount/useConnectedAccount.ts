import { useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import { useAlert } from "../../Contexts/Alert_Context";
import { BASE_URL } from "../../config/urls";
import type { RunFrequency } from "./useConnectedAccounts";

interface AppLocationPayload {
  serverConnectionId?: string;
  guestVmid?: number;
}

export interface CreateForgejoAccountPayload extends AppLocationPayload {
  displayName?: string;
  baseUrl: string;
  token: string;
}

export interface CreateOpenGymAccountPayload extends AppLocationPayload {
  displayName?: string;
  baseUrl: string;
  code: string;
}

export interface CreateGameTrackerAccountPayload extends AppLocationPayload {
  displayName?: string;
  baseUrl: string;
  token: string;
}

export interface CreateImmichAccountPayload extends AppLocationPayload {
  displayName?: string;
  baseUrl: string;
  apiKey: string;
}

export interface CreatePaperlessAccountPayload extends AppLocationPayload {
  displayName?: string;
  baseUrl: string;
  token: string;
}

export interface CreateStirlingAccountPayload extends AppLocationPayload {
  displayName?: string;
  baseUrl: string;
  apiKey: string;
}

export interface CreateSolidtimeAccountPayload extends AppLocationPayload {
  displayName?: string;
  baseUrl: string;
  token: string;
  organization?: string;
}

export interface CreateTrekAccountPayload extends AppLocationPayload {
  displayName?: string;
  baseUrl: string;
  email: string;
  password: string;
  mcpClientId?: string;
  mcpClientSecret?: string;
}

export interface CreateHomeAssistantAccountPayload extends AppLocationPayload {
  displayName?: string;
  baseUrl: string;
  token: string;
}

export interface CreateAdguardAccountPayload extends AppLocationPayload {
  displayName?: string;
  baseUrl: string;
  username: string;
  password: string;
}

export interface CreateNextcloudAccountPayload extends AppLocationPayload {
  displayName?: string;
  caldavUrl: string;
  caldavUsername: string;
  caldavPassword: string;
}

export const useConnectedAccount = () => {
  const [loading, setLoading] = useState(false);
  const { setAlert } = useAlert();

  const connectGoogleAccount = () => {
    window.location.href = `${BASE_URL}${End_Points.Connected_Account_Google_Connect_Endpoint()}`;
  };

  const connectGoogleTasksAccount = () => {
    window.location.href = `${BASE_URL}${End_Points.Connected_Account_Google_Tasks_Connect_Endpoint()}`;
  };

  const createNextcloudAccount = async (data: CreateNextcloudAccountPayload) => {
    setLoading(true);
    try {
      await http.post(End_Points.Connected_Account_Nextcloud_Endpoint(), data, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('addons:alerts.nextcloudConnected'), type: 'success' });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const createForgejoAccount = async (data: CreateForgejoAccountPayload) => {
    setLoading(true);
    try {
      await http.post(End_Points.Connected_Account_Forgejo_Endpoint(), data, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('addons:alerts.forgejoConnected'), type: 'success' });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const createOpenGymAccount = async (data: CreateOpenGymAccountPayload) => {
    setLoading(true);
    try {
      await http.post(End_Points.Connected_Account_OpenGym_Endpoint(), data, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('addons:alerts.openGymConnected'), type: 'success' });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const createGameTrackerAccount = async (data: CreateGameTrackerAccountPayload) => {
    setLoading(true);
    try {
      await http.post(End_Points.Connected_Account_GameTracker_Endpoint(), data, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('addons:alerts.gameTrackerConnected'), type: 'success' });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const createImmichAccount = async (data: CreateImmichAccountPayload) => {
    setLoading(true);
    try {
      await http.post(End_Points.Connected_Account_Immich_Endpoint(), data, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('addons:alerts.immichConnected'), type: 'success' });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const createPaperlessAccount = async (data: CreatePaperlessAccountPayload) => {
    setLoading(true);
    try {
      await http.post(End_Points.Connected_Account_Paperless_Endpoint(), data, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('addons:alerts.paperlessConnected'), type: 'success' });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const createStirlingAccount = async (data: CreateStirlingAccountPayload) => {
    setLoading(true);
    try {
      await http.post(End_Points.Connected_Account_Stirling_Endpoint(), data, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('addons:alerts.stirlingConnected'), type: 'success' });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const createSolidtimeAccount = async (data: CreateSolidtimeAccountPayload) => {
    setLoading(true);
    try {
      await http.post(End_Points.Connected_Account_Solidtime_Endpoint(), data, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('addons:alerts.solidtimeConnected'), type: 'success' });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const createHomeAssistantAccount = async (data: CreateHomeAssistantAccountPayload) => {
    setLoading(true);
    try {
      await http.post(End_Points.Connected_Account_Home_Assistant_Endpoint(), data, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('addons:alerts.homeAssistantConnected'), type: 'success' });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const createAdguardAccount = async (data: CreateAdguardAccountPayload) => {
    setLoading(true);
    try {
      await http.post(End_Points.Connected_Account_Adguard_Endpoint(), data, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('addons:alerts.adguardConnected'), type: 'success' });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const createTrekAccount = async (data: CreateTrekAccountPayload) => {
    setLoading(true);
    try {
      await http.post(End_Points.Connected_Account_Trek_Endpoint(), data, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('addons:alerts.trekConnected'), type: 'success' });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteConnectedAccount = async (id: string) => {
    setLoading(true);
    try {
      await http.delete(End_Points.Connected_Account_By_Id_Endpoint(id), { withCredentials: true });
      setAlert({ open: true, message: i18n.t('email:alerts.accountRemoved'), type: 'success' });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateRunFrequency = async (id: string, runFrequency: RunFrequency) => {
    setLoading(true);
    try {
      await http.patch(End_Points.Connected_Account_By_Id_Endpoint(id), { runFrequency }, { withCredentials: true });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateProposalSettings = async (
    id: string,
    changes: { proposalFrequency?: RunFrequency | null; autoImplementProposalsAfterDays?: number | null },
  ) => {
    try {
      await http.patch(End_Points.Connected_Account_By_Id_Endpoint(id), changes, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('email:alerts.proposalSettingsSaved'), type: 'success' });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    }
  };

  const updateLocation = async (id: string, location: { serverConnectionId: string | null; guestVmid: number | null }) => {
    setLoading(true);
    try {
      await http.patch(End_Points.Connected_Account_By_Id_Endpoint(id), location, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('addons:alerts.locationSaved'), type: 'success' });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    connectGoogleAccount,
    updateLocation,
    createNextcloudAccount,
    createForgejoAccount,
    createOpenGymAccount,
    createGameTrackerAccount,
    createImmichAccount,
    createPaperlessAccount,
    createStirlingAccount,
    createSolidtimeAccount,
    createTrekAccount,
    createHomeAssistantAccount,
    createAdguardAccount,
    deleteConnectedAccount,
    connectGoogleTasksAccount,
    updateRunFrequency,
    updateProposalSettings,
    loading,
  };
};
