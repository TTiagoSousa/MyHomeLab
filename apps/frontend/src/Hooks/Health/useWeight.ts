import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import type { WeightAverages, WeightEntry } from "./healthTypes";

export interface WeightPayload {
  weightKg: number;
  measuredAt: string;
  timeZone: string;
}

const errorMessage = (error: any): string => {
  const message = error?.response?.data?.message;
  return (Array.isArray(message) ? message.join(' ') : message) || error?.message || i18n.t('common:errors.generic');
};

export const useWeight = (days: number) => {
  const [averages, setAverages] = useState<WeightAverages | null>(null);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setAlert } = useAlert();

  const fetchWeight = async () => {
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Weight_Endpoint(), { params: { days }, withCredentials: true });
      setAverages(response.data.averages);
      setEntries(response.data.entries);
    } catch (error: any) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeight();
  }, [days]);

  const addWeight = async (payload: WeightPayload): Promise<string | null> => {
    setSaving(true);
    try {
      await http.post(End_Points.Health_Weight_Endpoint(), payload, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('health:weight.saved'), type: 'success' });
      await fetchWeight();
      return null;
    } catch (error: any) {
      return errorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const removeWeight = async (id: string) => {
    try {
      await http.delete(End_Points.Health_Weight_By_Id_Endpoint(id), { withCredentials: true });
      await fetchWeight();
    } catch (error: any) {
      setAlert({ open: true, message: errorMessage(error), type: 'error' });
    }
  };

  return { averages, entries, loading, saving, error, addWeight, removeWeight };
};
