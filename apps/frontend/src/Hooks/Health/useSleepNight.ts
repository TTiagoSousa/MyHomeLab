import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import type { SleepSessionDetail } from "./healthTypes";

export const useSleepNight = (id: string | null) => {
  const [night, setNight] = useState<SleepSessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSleepNight = async () => {
    if (!id) {
      setNight(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Sleep_By_Id_Endpoint(id), { withCredentials: true });
      setNight(response.data);
    } catch (error: any) {
      setError(error?.response?.data?.message || error?.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSleepNight();
  }, [id]);

  return { night, loading, error };
};
