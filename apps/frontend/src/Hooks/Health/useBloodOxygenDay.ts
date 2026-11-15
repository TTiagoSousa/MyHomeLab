import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import type { BloodOxygenDayDetail } from "./healthTypes";

export const useBloodOxygenDay = (id: string | null) => {
  const [oxygenDay, setOxygenDay] = useState<BloodOxygenDayDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBloodOxygenDay = async () => {
    if (!id) {
      setOxygenDay(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Blood_Oxygen_By_Id_Endpoint(id), { withCredentials: true });
      setOxygenDay(response.data);
    } catch (error: any) {
      setError(error?.response?.data?.message || error?.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBloodOxygenDay();
  }, [id]);

  return { oxygenDay, loading, error };
};
