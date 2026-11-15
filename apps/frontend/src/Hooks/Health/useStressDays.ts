import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import type { StressAverages, StressDay } from "./healthTypes";

export const useStressDays = (days: number) => {
  const [averages, setAverages] = useState<StressAverages | null>(null);
  const [stressDays, setStressDays] = useState<StressDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStressDays = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Stress_Endpoint(), {
        params: { days },
        withCredentials: true,
      });
      setAverages(response.data.averages);
      setStressDays(response.data.days);
    } catch (error: any) {
      setError(error?.response?.data?.message || error?.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStressDays();
  }, [days]);

  return { averages, stressDays, loading, error, fetchStressDays };
};
