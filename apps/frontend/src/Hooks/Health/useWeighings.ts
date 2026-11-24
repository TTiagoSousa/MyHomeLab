import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import type { WeightEntry } from "./healthTypes";

export const useWeighings = (refreshKey: number) => {
  const [weighings, setWeighings] = useState<WeightEntry[]>([]);

  const fetchWeighings = async () => {
    try {
      const response = await http.get(End_Points.Health_Weight_Endpoint(), { params: { days: 30 }, withCredentials: true });
      setWeighings(response.data.entries);
    } catch {
      setWeighings([]);
    }
  };

  useEffect(() => {
    fetchWeighings();
  }, [refreshKey]);

  return { weighings };
};
