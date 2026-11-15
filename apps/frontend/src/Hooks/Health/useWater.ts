import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import type { WaterAverages, WaterDay } from "./healthTypes";

export interface WaterPayload {
  ml: number;
  drankAt: string;
  timeZone: string;
}

const errorMessage = (error: any): string => {
  const message = error?.response?.data?.message;
  return (Array.isArray(message) ? message.join(' ') : message) || error?.message || i18n.t('common:errors.generic');
};

export const useWater = (days: number) => {
  const [averages, setAverages] = useState<WaterAverages | null>(null);
  const [waterDays, setWaterDays] = useState<WaterDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setAlert } = useAlert();

  const fetchWater = async () => {
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Water_Endpoint(), { params: { days }, withCredentials: true });
      setAverages(response.data.averages);
      setWaterDays(response.data.days);
    } catch (error: any) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWater();
  }, [days]);

  const addWater = async (payload: WaterPayload) => {
    setSaving(true);
    try {
      await http.post(End_Points.Health_Water_Endpoint(), payload, { withCredentials: true });
      await fetchWater();
    } catch (error: any) {
      setAlert({ open: true, message: errorMessage(error), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const removeWater = async (id: string) => {
    try {
      await http.delete(End_Points.Health_Water_By_Id_Endpoint(id), { withCredentials: true });
      await fetchWater();
    } catch (error: any) {
      setAlert({ open: true, message: errorMessage(error), type: 'error' });
    }
  };

  return { averages, waterDays, loading, saving, error, addWater, removeWater };
};
