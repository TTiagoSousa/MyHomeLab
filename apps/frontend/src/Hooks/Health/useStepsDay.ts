import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import type { ActivityDayDetail } from "./healthTypes";

export const useStepsDay = (id: string | null) => {
  const [stepsDay, setStepsDay] = useState<ActivityDayDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStepsDay = async () => {
    if (!id) {
      setStepsDay(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Steps_By_Id_Endpoint(id), { withCredentials: true });
      setStepsDay(response.data);
    } catch (error: any) {
      setError(error?.response?.data?.message || error?.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStepsDay();
  }, [id]);

  return { stepsDay, loading, error };
};
