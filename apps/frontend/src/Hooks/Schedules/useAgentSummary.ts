import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";

export const useAgentSummary = (initialMessage: string, day: string) => {
  const [message, setMessage] = useState<string | null>(initialMessage);
  const [loading, setLoading] = useState(false);
  const { setAlert } = useAlert();

  const fetchSummary = async (from: string, to: string, quiet = false) => {
    if (!from || !to) return;
    if (!quiet) setLoading(true);
    try {
      const response = await http.get(End_Points.Schedules_Summary_Endpoint(), { params: { from, to }, withCredentials: true });
      setMessage(response.data.message);
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary(day, day, true);
  }, [day]);

  return { message, loading, fetchSummary };
};
