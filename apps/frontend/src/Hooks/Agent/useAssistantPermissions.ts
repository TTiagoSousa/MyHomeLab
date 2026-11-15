import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";

export const useAssistantPermissions = () => {
  const [denied, setDenied] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { setAlert } = useAlert();

  const showError = (error: unknown) => {
    const failure = error as { response?: { data?: { message?: string } }; message?: string };
    setAlert({ open: true, message: failure?.response?.data?.message || failure?.message || i18n.t('common:errors.generic'), type: 'error' });
  };

  const fetchPermissions = async () => {
    try {
      const response = await http.get(End_Points.Agent_Permissions_Endpoint(), { withCredentials: true });
      setDenied(response.data.denied);
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const saveDenied = async (next: string[]) => {
    const previous = denied;
    setDenied(next);
    setSaving(true);
    try {
      const response = await http.put(End_Points.Agent_Permissions_Endpoint(), { denied: next }, { withCredentials: true });
      setDenied(response.data.denied);
    } catch (error) {
      setDenied(previous);
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const setAllowed = (keys: string[], allowed: boolean) =>
    saveDenied(allowed ? denied.filter((key) => !keys.includes(key)) : [...new Set([...denied, ...keys])]);

  return { denied, loading, saving, setAllowed };
};
