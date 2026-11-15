import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import type { StressDayDetail } from "./healthTypes";

export const useStressDay = (id: string | null) => {
  const [stressDay, setStressDay] = useState<StressDayDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStressDay = async () => {
    if (!id) {
      setStressDay(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Stress_By_Id_Endpoint(id), { withCredentials: true });
      setStressDay(response.data);
    } catch (error: any) {
      setError(error?.response?.data?.message || error?.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStressDay();
  }, [id]);

  return { stressDay, loading, error };
};
