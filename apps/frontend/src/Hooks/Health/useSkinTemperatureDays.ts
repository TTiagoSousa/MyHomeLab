import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import type { SkinTemperatureAverages, SkinTemperatureDay } from "./healthTypes";

export const useSkinTemperatureDays = (days: number) => {
  const [averages, setAverages] = useState<SkinTemperatureAverages | null>(null);
  const [temperatureDays, setTemperatureDays] = useState<SkinTemperatureDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSkinTemperatureDays = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Skin_Temperature_Endpoint(), {
        params: { days },
        withCredentials: true,
      });
      setAverages(response.data.averages);
      setTemperatureDays(response.data.days);
    } catch (error: any) {
      setError(error?.response?.data?.message || error?.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkinTemperatureDays();
  }, [days]);

  return { averages, temperatureDays, loading, error, fetchSkinTemperatureDays };
};
