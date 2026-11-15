import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { healthErrorMessage } from "./healthErrors";
import type { LabHistoryPoint } from "./healthTypes";

export const useLabParameter = (key: string | null) => {
  const [history, setHistory] = useState<LabHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!key) {
      setHistory([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Lab_Parameter_Endpoint(key), { withCredentials: true });
      setHistory(response.data);
    } catch (error: any) {
      setError(healthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [key]);

  return { history, loading, error };
};
