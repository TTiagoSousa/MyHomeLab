import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import type { ExerciseType } from "./healthTypes";

export const useExerciseTypes = () => {
  const [sports, setSports] = useState<ExerciseType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTypes = async () => {
    try {
      const response = await http.get(End_Points.Health_Exercise_Types_Endpoint(), { withCredentials: true });
      setSports(response.data);
    } catch {
      setSports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  return { sports, loading };
};
