import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";

export interface AiModels {
  main: string;
  agent: string;
}

export interface AiProviderEntry {
  provider: string;
  keyHint: string;
  usesMachineLogin: boolean;
  updatedAt: string | null;
  isActive: boolean;
  models: AiModels;
  defaultModels: AiModels;
}

export interface ClaudeCodeStatus {
  installed: boolean;
  version: string | null;
  loggedIn: boolean;
  authMethod: string | null;
  subscription: string | null;
  expiresAt: string | null;
  usesToken: boolean;
  error: string | null;
}

const PROVIDER = 'claude-code';

export const aiErrorMessage = (error: any): string => {
  const code = error?.response?.data?.code;
  if (code && i18n.exists(`settings:ai.errors.${code}`)) return i18n.t(`settings:ai.errors.${code}`);
  return error?.response?.data?.message || error?.message || i18n.t('common:errors.generic');
};

export const useAiProviders = () => {
  const [providers, setProviders] = useState<AiProviderEntry[]>([]);
  const [status, setStatus] = useState<ClaudeCodeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const { setAlert } = useAlert();

  const fetchProviders = async () => {
    try {
      const response = await http.get(End_Points.Ai_Providers_Endpoint(), { withCredentials: true });
      setProviders(response.data);
    } catch {
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async () => {
    setChecking(true);
    try {
      const response = await http.get(End_Points.Ai_Claude_Code_Status_Endpoint(), { withCredentials: true });
      setStatus(response.data);
    } catch {
      setStatus(null);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const saveKey = async (apiKey: string): Promise<string | null> => {
    setSaving(true);
    try {
      await http.put(End_Points.Ai_Provider_Endpoint(PROVIDER), { apiKey }, { withCredentials: true });
      await fetchProviders();
      await fetchStatus();
      setAlert({ open: true, message: i18n.t('settings:ai.saved'), type: 'success' });
      return null;
    } catch (error: any) {
      return aiErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const removeKey = async () => {
    try {
      await http.delete(End_Points.Ai_Provider_Endpoint(PROVIDER), { withCredentials: true });
      await fetchProviders();
      await fetchStatus();
      setAlert({ open: true, message: i18n.t('settings:ai.removed'), type: 'success' });
    } catch (error: any) {
      setAlert({ open: true, message: aiErrorMessage(error), type: 'error' });
    }
  };

  const saveModels = async (models: AiModels) => {
    try {
      await http.put(End_Points.Ai_Provider_Models_Endpoint(PROVIDER), models, { withCredentials: true });
      await fetchProviders();
      setAlert({ open: true, message: i18n.t('settings:ai.modelsSaved'), type: 'success' });
      return true;
    } catch (error: any) {
      setAlert({ open: true, message: aiErrorMessage(error), type: 'error' });
      return false;
    }
  };

  return { providers, status, loading, checking, saving, fetchProviders, fetchStatus, saveKey, removeKey, saveModels };
};
