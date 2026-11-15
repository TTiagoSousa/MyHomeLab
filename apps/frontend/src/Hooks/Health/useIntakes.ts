import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { healthErrorMessage } from "./healthErrors";
import type { IntakeItemPayload, IntakePayload, IntakeSettingsPayload, IntakesData } from "./intakesTypes";

export const useIntakes = (days: number) => {
  const [data, setData] = useState<IntakesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setAlert } = useAlert();

  const fetchIntakes = async () => {
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Intakes_Endpoint(), { params: { days }, withCredentials: true });
      setData(response.data);
    } catch (error) {
      setError(healthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntakes();
  }, [days]);

  const saveEntry = async (payload: IntakePayload, id?: string): Promise<string | null> => {
    setSaving(true);
    try {
      if (id) {
        await http.put(End_Points.Health_Intake_By_Id_Endpoint(id), payload, { withCredentials: true });
      } else {
        await http.post(End_Points.Health_Intakes_Endpoint(), payload, { withCredentials: true });
      }
      setAlert({ open: true, message: i18n.t('health:intakes.saved'), type: 'success' });
      await fetchIntakes();
      return null;
    } catch (error) {
      return healthErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async (id: string) => {
    try {
      await http.delete(End_Points.Health_Intake_By_Id_Endpoint(id), { withCredentials: true });
      await fetchIntakes();
    } catch (error) {
      setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });
    }
  };

  const saveItem = async (payload: IntakeItemPayload, id?: string): Promise<string | null> => {
    setSaving(true);
    try {
      if (id) {
        await http.put(End_Points.Health_Intake_Item_By_Id_Endpoint(id), payload, { withCredentials: true });
      } else {
        await http.post(End_Points.Health_Intake_Items_Endpoint(), payload, { withCredentials: true });
      }
      setAlert({ open: true, message: i18n.t('health:intakes.items.saved'), type: 'success' });
      await fetchIntakes();
      return null;
    } catch (error) {
      return healthErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (id: string) => {
    try {
      await http.delete(End_Points.Health_Intake_Item_By_Id_Endpoint(id), { withCredentials: true });
      await fetchIntakes();
    } catch (error) {
      setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });
    }
  };

  const saveSettings = async (payload: IntakeSettingsPayload): Promise<string | null> => {
    setSaving(true);
    try {
      await http.put(End_Points.Health_Intake_Settings_Endpoint(), payload, { withCredentials: true });
      await fetchIntakes();
      return null;
    } catch (error) {
      return healthErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  return { data, loading, saving, error, saveEntry, removeEntry, saveItem, removeItem, saveSettings };
};
