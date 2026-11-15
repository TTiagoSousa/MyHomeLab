import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { healthErrorMessage } from "./healthErrors";
import type { LabReport } from "./healthTypes";

export const useLabReport = (id: string | null) => {
  const [report, setReport] = useState<LabReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setAlert } = useAlert();

  const fetchReport = async () => {
    if (!id) return;
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Lab_By_Id_Endpoint(id), { withCredentials: true });
      setReport(response.data);
    } catch (error: any) {
      setError(healthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [id]);

  const removeReport = async (): Promise<boolean> => {
    if (!id) return false;
    try {
      await http.delete(End_Points.Health_Lab_By_Id_Endpoint(id), { withCredentials: true });
      setAlert({ open: true, message: i18n.t('health:labs.deleted'), type: 'success' });
      return true;
    } catch (error: any) {
      setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });
      return false;
    }
  };

  return { report, loading, error, fetchReport, removeReport };
};
