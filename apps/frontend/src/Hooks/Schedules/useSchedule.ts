import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import type { Schedule, SchedulePayload } from "./scheduleTypes";

const RUNNING_REFRESH_MS = 5000;

const errorMessage = (error: any) =>
  error.response?.data?.message || error.message || i18n.t('common:errors.generic');

export const useSchedule = (id?: string) => {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { setAlert } = useAlert();

  const fetchSchedule = async () => {
    if (!id) return;
    try {
      const response = await http.get(End_Points.Schedule_By_Id_Endpoint(id), { withCredentials: true });
      setSchedule(response.data);
      setError('');
    } catch (error: any) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [id]);

  useEffect(() => {
    if (schedule?.runs[0]?.status !== 'RUNNING') return;
    const timer = setTimeout(fetchSchedule, RUNNING_REFRESH_MS);
    return () => clearTimeout(timer);
  }, [schedule]);

  const saveSchedule = async (payload: SchedulePayload): Promise<string | null> => {
    if (!id) return null;
    setSaving(true);
    try {
      const response = await http.put(End_Points.Schedule_By_Id_Endpoint(id), payload, { withCredentials: true });
      setSchedule(response.data);
      setAlert({ open: true, message: i18n.t('schedules:alerts.saved'), type: 'success' });
      return null;
    } catch (error: any) {
      return errorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const runSchedule = async () => {
    if (!id) return;
    try {
      const response = await http.post(End_Points.Schedule_Run_Endpoint(id), {}, { withCredentials: true });
      setSchedule(response.data);
      setAlert({ open: true, message: i18n.t('schedules:alerts.running'), type: 'success' });
    } catch (error: any) {
      setAlert({ open: true, message: errorMessage(error), type: 'error' });
    }
  };

  const deleteSchedule = async (): Promise<boolean> => {
    if (!id) return false;
    try {
      await http.delete(End_Points.Schedule_By_Id_Endpoint(id), { withCredentials: true });
      setAlert({ open: true, message: i18n.t('schedules:alerts.deleted'), type: 'success' });
      return true;
    } catch (error: any) {
      setAlert({ open: true, message: errorMessage(error), type: 'error' });
      return false;
    }
  };

  return { schedule, loading, saving, error, saveSchedule, runSchedule, deleteSchedule };
};
