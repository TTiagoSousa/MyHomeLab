import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import type { SkinTemperatureDayDetail } from "./healthTypes";

export const useSkinTemperatureDay = (id: string | null) => {
  const [temperatureDay, setTemperatureDay] = useState<SkinTemperatureDayDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSkinTemperatureDay = async () => {
    if (!id) {
      setTemperatureDay(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Skin_Temperature_By_Id_Endpoint(id), { withCredentials: true });
      setTemperatureDay(response.data);
    } catch (error: any) {
      setError(error?.response?.data?.message || error?.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkinTemperatureDay();
  }, [id]);

  return { temperatureDay, loading, error };
};
