import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import type { BloodOxygenAverages, BloodOxygenDay } from "./healthTypes";

export const useBloodOxygenDays = (days: number) => {
  const [averages, setAverages] = useState<BloodOxygenAverages | null>(null);
  const [oxygenDays, setOxygenDays] = useState<BloodOxygenDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBloodOxygenDays = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Blood_Oxygen_Endpoint(), {
        params: { days },
        withCredentials: true,
      });
      setAverages(response.data.averages);
      setOxygenDays(response.data.days);
    } catch (error: any) {
      setError(error?.response?.data?.message || error?.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBloodOxygenDays();
  }, [days]);

  return { averages, oxygenDays, loading, error, fetchBloodOxygenDays };
};
