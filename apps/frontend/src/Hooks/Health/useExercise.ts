import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { healthErrorMessage } from "./healthErrors";
import type { ExerciseAverages, ExerciseTotal, Workout } from "./healthTypes";

export interface WorkoutsSyncResult {
  checked: number;
  heart: number;
  calories: number;
}

export const useExercise = (days: number) => {
  const [averages, setAverages] = useState<ExerciseAverages | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [moves, setMoves] = useState<ExerciseTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<WorkoutsSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { setAlert } = useAlert();

  const fetchExercise = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Exercise_Endpoint(), {
        params: { days },
        withCredentials: true,
      });
      setAverages(response.data.averages);
      setWorkouts(response.data.workouts);
      setMoves(response.data.moves ?? []);
    } catch (error: any) {
      setError(error?.response?.data?.message || error?.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExercise();
  }, [days]);

  const syncWorkouts = async () => {
    setSyncing(true);
    try {
      const response = await http.post(End_Points.Health_Workouts_Sync_Endpoint(), {}, { withCredentials: true });
      setSyncResult(response.data);
      await fetchExercise();
    } catch (error: any) {
      setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  return { averages, workouts, moves, loading, syncing, syncResult, error, fetchExercise, syncWorkouts };
};
