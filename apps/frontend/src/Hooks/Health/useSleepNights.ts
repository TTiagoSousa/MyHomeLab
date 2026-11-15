import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import type { SleepAverages, SleepSession } from "./healthTypes";

export const useSleepNights = (days: number) => {
  const [averages, setAverages] = useState<SleepAverages | null>(null);
  const [sessions, setSessions] = useState<SleepSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSleepNights = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Sleep_Endpoint(), {
        params: { days },
        withCredentials: true,
      });
      setAverages(response.data.averages);
      setSessions(response.data.sessions);
    } catch (error: any) {
      setError(error?.response?.data?.message || error?.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSleepNights();
  }, [days]);

  return { averages, sessions, loading, error, fetchSleepNights };
};
