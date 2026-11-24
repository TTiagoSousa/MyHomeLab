import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { healthErrorMessage } from "./healthErrors";
import type { HealthMetric, MetricAverages, MetricPoint } from "./healthTypes";

export interface MetricValuePayload {
  value: number;
  deviceId: string | null;
  measuredAt: string;
  timeZone: string;
  entryId?: string;
}

export const useHealthMetric = (metric: HealthMetric, days: number) => {
  const [averages, setAverages] = useState<MetricAverages | null>(null);
  const [points, setPoints] = useState<MetricPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { setAlert } = useAlert();

  const fetchMetric = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Metric_Endpoint(metric), { params: { days }, withCredentials: true });
      setAverages(response.data.averages);
      setPoints(response.data.points);
    } catch (error: any) {
      setError(healthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetric();
  }, [metric, days]);

  const addValue = async (payload: MetricValuePayload): Promise<string | null> => {
    setSaving(true);
    try {
      await http.post(End_Points.Health_Metric_Endpoint(metric), payload, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('health:bodyMetrics.saved'), type: 'success' });
      await fetchMetric();
      return null;
    } catch (error: any) {
      return healthErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const removeValue = async (id: string) => {
    try {
      await http.delete(End_Points.Health_Metric_Value_Endpoint(metric, id), { withCredentials: true });
      await fetchMetric();
    } catch (error: any) {
      setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });
    }
  };

  return { averages, points, loading, saving, error, addValue, removeValue };
};
