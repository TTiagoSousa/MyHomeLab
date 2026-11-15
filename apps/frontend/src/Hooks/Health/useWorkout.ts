import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { healthErrorMessage } from "./healthErrors";
import type { WorkoutDetail, WorkoutPartPayload } from "./healthTypes";

export interface WorkoutSyncResult {
  heart: boolean;
  calories: boolean;
}

export const useWorkout = (id: string | null) => {
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<WorkoutSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { setAlert } = useAlert();

  const fetchWorkout = async () => {
    if (!id) {
      setWorkout(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Workout_By_Id_Endpoint(id), { withCredentials: true });
      setWorkout(response.data);
    } catch (error: any) {
      setError(error?.response?.data?.message || error?.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkout();
  }, [id]);

  const syncWorkout = async () => {
    if (!id) return;
    setSyncing(true);
    try {
      const response = await http.post(End_Points.Health_Workout_Sync_Endpoint(id), {}, { withCredentials: true });
      setSyncResult(response.data);
      await fetchWorkout();
    } catch (error: any) {
      setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const saveParts = async (parts: WorkoutPartPayload[]): Promise<string | null> => {
    if (!id) return null;
    try {
      const response = await http.put(End_Points.Health_Workout_Parts_Endpoint(id), { parts }, { withCredentials: true });
      setWorkout(response.data);
      setAlert({ open: true, message: i18n.t('health:sessions.saved'), type: 'success' });
      return null;
    } catch (error: any) {
      return healthErrorMessage(error);
    }
  };

  const detachPart = async (partId: string) => {
    try {
      await http.delete(End_Points.Health_Workout_Parent_Endpoint(partId), { withCredentials: true });
      setAlert({ open: true, message: i18n.t('health:sessions.detached'), type: 'success' });
      await fetchWorkout();
    } catch (error: any) {
      setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });
    }
  };

  return { workout, loading, syncing, syncResult, error, fetchWorkout, syncWorkout, saveParts, detachPart };
};
