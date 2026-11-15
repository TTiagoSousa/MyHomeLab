import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import type { HeartAverages, HeartDay } from "./healthTypes";

export const useHeartDays = (days: number) => {
  const [averages, setAverages] = useState<HeartAverages | null>(null);
  const [heartDays, setHeartDays] = useState<HeartDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHeartDays = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Heart_Endpoint(), {
        params: { days },
        withCredentials: true,
      });
      setAverages(response.data.averages);
      setHeartDays(response.data.days);
    } catch (error: any) {
      setError(error?.response?.data?.message || error?.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeartDays();
  }, [days]);

  return { averages, heartDays, loading, error, fetchHeartDays };
};
