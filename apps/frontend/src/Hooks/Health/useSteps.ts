import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import type { StepsAverages, ActivityDay } from "./healthTypes";

export const useSteps = (days: number) => {
  const [averages, setAverages] = useState<StepsAverages | null>(null);
  const [stepsDays, setStepsDays] = useState<ActivityDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSteps = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Steps_Endpoint(), {
        params: { days },
        withCredentials: true,
      });
      setAverages(response.data.averages);
      setStepsDays(response.data.days);
    } catch (error: any) {
      setError(error?.response?.data?.message || error?.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSteps();
  }, [days]);

  return { averages, stepsDays, loading, error, fetchSteps };
};
