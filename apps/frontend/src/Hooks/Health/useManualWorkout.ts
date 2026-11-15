import { useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { healthErrorMessage } from "./healthErrors";
import type { ManualWorkoutPayload, WorkoutSaveResult } from "./healthTypes";

export const useManualWorkout = () => {
  const [saving, setSaving] = useState(false);
  const { setAlert } = useAlert();

  const saveWorkout = async (payload: ManualWorkoutPayload, id?: string): Promise<WorkoutSaveResult> => {
    setSaving(true);
    try {
      const response = id
        ? await http.put(End_Points.Health_Workout_By_Id_Endpoint(id), payload, { withCredentials: true })
        : await http.post(End_Points.Health_Workouts_Endpoint(), payload, { withCredentials: true });
      return { error: null, sync: response.data?.sync ?? null };
    } catch (error) {
      return { error: healthErrorMessage(error), sync: null };
    } finally {
      setSaving(false);
    }
  };

  const deleteWorkout = async (id: string): Promise<boolean> => {
    try {
      await http.delete(End_Points.Health_Workout_By_Id_Endpoint(id), { withCredentials: true });
      setAlert({ open: true, message: i18n.t('health:exercise.manual.deleted'), type: 'success' });
      return true;
    } catch (error) {
      setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });
      return false;
    }
  };

  return { saving, saveWorkout, deleteWorkout };
};
