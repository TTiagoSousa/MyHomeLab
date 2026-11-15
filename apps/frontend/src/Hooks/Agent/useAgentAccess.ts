import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";

export type AccessLevel = 'NONE' | 'READ' | 'WRITE';

export interface AgentAccessRow {
  agentKey: string;
  name: string;
  isActive: boolean;
  canRead: boolean;
  canWrite: boolean;
  level: AccessLevel | null;
}

const errorMessage = (error: any) => error.response?.data?.message || error.message || i18n.t('common:errors.generic');

export const useAgentAccess = (type: 'APP' | 'SERVER', targetId: string) => {
  const [rows, setRows] = useState<AgentAccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const { setAlert } = useAlert();

  const fetchAccess = async () => {
    try {
      const response = await http.get(End_Points.Agent_Access_Endpoint(), { params: { type, targetId }, withCredentials: true });
      setRows(response.data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccess();
  }, [type, targetId]);

  const saveLevel = async (agentKey: string, level: AccessLevel | null) => {
    setSavingKey(agentKey);
    try {
      const response = await http.put(End_Points.Agent_Access_Endpoint(), { type, targetId, agentKey, level }, { withCredentials: true });
      setRows(response.data);
    } catch (error: any) {
      setAlert({ open: true, message: errorMessage(error), type: 'error' });
    } finally {
      setSavingKey(null);
    }
  };

  return { rows, loading, savingKey, saveLevel };
};
