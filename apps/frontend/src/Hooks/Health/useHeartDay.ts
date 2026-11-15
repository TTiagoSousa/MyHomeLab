import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import type { HeartDayDetail } from "./healthTypes";

export const useHeartDay = (id: string | null) => {
  const [heartDay, setHeartDay] = useState<HeartDayDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHeartDay = async () => {
    if (!id) {
      setHeartDay(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Heart_By_Id_Endpoint(id), { withCredentials: true });
      setHeartDay(response.data);
    } catch (error: any) {
      setError(error?.response?.data?.message || error?.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeartDay();
  }, [id]);

  return { heartDay, loading, error };
};
