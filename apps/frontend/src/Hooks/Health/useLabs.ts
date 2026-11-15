import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { healthErrorMessage } from "./healthErrors";
import type { LabParameter, LabReportSummary } from "./healthTypes";

export const useLabs = () => {
  const [reports, setReports] = useState<LabReportSummary[]>([]);
  const [parameters, setParameters] = useState<LabParameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLabs = async () => {
    setError(null);
    try {
      const [reportsResponse, parametersResponse] = await Promise.all([
        http.get(End_Points.Health_Labs_Endpoint(), { withCredentials: true }),
        http.get(End_Points.Health_Lab_Parameters_Endpoint(), { withCredentials: true }),
      ]);
      setReports(reportsResponse.data);
      setParameters(parametersResponse.data);
    } catch (error: any) {
      setError(healthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLabs();
  }, []);

  return { reports, parameters, loading, error, fetchLabs };
};
