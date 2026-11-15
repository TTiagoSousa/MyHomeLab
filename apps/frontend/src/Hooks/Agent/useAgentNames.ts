import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import type { ScheduleAgent } from "../Schedules/scheduleTypes";

export const useAgentNames = () => {
  const [agents, setAgents] = useState<ScheduleAgent[]>([]);

  const fetchAgents = async () => {
    try {
      const response = await http.get(End_Points.Agent_Endpoint(), { withCredentials: true });
      setAgents(response.data.map((agent: ScheduleAgent) => ({ key: agent.key, name: agent.name, isActive: agent.isActive })));
    } catch {
      setAgents([]);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  return { agents };
};
