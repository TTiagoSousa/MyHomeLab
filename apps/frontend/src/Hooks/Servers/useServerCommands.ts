import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";

export type ServerCommandStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'REJECTED' | 'BLOCKED';

export interface ServerCommand {
  id: string;
  code: string;
  command: string;
  reason: string | null;
  status: ServerCommandStatus;
  autoApproved: boolean;
  snapshotName: string | null;
  requestedBy: string | null;
  output: string | null;
  exitCode: number | null;
  createdAt: string;
  finishedAt: string | null;
}


export const useServerCommands = (serverId: string | undefined) => {
  const [commands, setCommands] = useState<ServerCommand[]>([]);

  const fetchCommands = async () => {
    if (!serverId) return;
    try {
      const response = await http.get(End_Points.Server_Commands_Endpoint(serverId), { withCredentials: true });
      setCommands(response.data);
    } catch {
      setCommands([]);
    }
  };

  useEffect(() => {
    fetchCommands();
  }, [serverId]);

  return { commands, fetchCommands };
};
