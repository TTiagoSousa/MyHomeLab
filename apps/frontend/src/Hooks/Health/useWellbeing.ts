import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { healthErrorMessage } from "./healthErrors";
import type { FastPayload, MoodPayload, WellbeingData } from "./healthLogTypes";

export const useWellbeing = (days: number, today: string) => {
  const [data, setData] = useState<WellbeingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setAlert } = useAlert();

  const fetchWellbeing = async () => {
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Wellbeing_Endpoint(), {
        params: { days: days > 0 ? days * 2 : 0, today },
        withCredentials: true,
      });
      setData({ moods: response.data.moods, fasts: response.data.fasts });
    } catch (error) {
      setError(healthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWellbeing();
  }, [days, today]);

  const showError = (error: unknown) => setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });

  const saveMood = async (day: string, payload: MoodPayload): Promise<string | null> => {
    setSaving(true);
    try {
      await http.put(End_Points.Health_Mood_Endpoint(day), payload, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('health:mood.form.saved'), type: 'success' });
      await fetchWellbeing();
      return null;
    } catch (error) {
      return healthErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const removeMood = async (day: string) => {
    try {
      await http.delete(End_Points.Health_Mood_Endpoint(day), { withCredentials: true });
      await fetchWellbeing();
    } catch (error) {
      showError(error);
    }
  };

  const saveFast = async (payload: FastPayload, id?: string): Promise<string | null> => {
    setSaving(true);
    try {
      if (id) {
        await http.put(End_Points.Health_Fast_By_Id_Endpoint(id), payload, { withCredentials: true });
      } else {
        await http.post(End_Points.Health_Fasts_Endpoint(), payload, { withCredentials: true });
      }
      setAlert({ open: true, message: i18n.t('health:fasting.saved'), type: 'success' });
      await fetchWellbeing();
      return null;
    } catch (error) {
      return healthErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const removeFast = async (id: string) => {
    try {
      await http.delete(End_Points.Health_Fast_By_Id_Endpoint(id), { withCredentials: true });
      await fetchWellbeing();
    } catch (error) {
      showError(error);
    }
  };

  return {
    data,
    loading,
    saving,
    error,
    saveMood,
    removeMood,
    saveFast,
    removeFast,
  };
};
