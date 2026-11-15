import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { healthErrorMessage } from "./healthErrors";
import type { Workout } from "./healthTypes";

export const useWorkoutPartCandidates = (workoutId: string) => {
  const [candidates, setCandidates] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCandidates = async () => {
    try {
      const response = await http.get(End_Points.Health_Workout_Part_Candidates_Endpoint(workoutId), { withCredentials: true });
      setCandidates(response.data);
    } catch (error: any) {
      setError(healthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [workoutId]);

  return { candidates, loading, error };
};
