import { useEffect, useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import { BASE_URL } from '../../config/urls';
import i18n from '../../i18n';

export type AgentLogKind = 'REQUEST' | 'START' | 'ACTION' | 'DONE' | 'FAILED';

export interface AgentLog {
  id: string;
  agent: string;
  kind: AgentLogKind;
  text: string;
  requestedBy: string | null;
  durationMs: number | null;
  createdAt: string;
}

const PAGE_SIZE = 100;
const MAX_LINES = 1000;

export const useAgentLogs = (agent: string | null) => {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [error, setError] = useState('');

  const fetchLogs = async (before?: string) => {
    setLoading(true);
    try {
      const response = await http.get(End_Points.Agent_Logs_Endpoint(), {
        params: { agent: agent ?? undefined, before, limit: PAGE_SIZE },
        withCredentials: true,
      });
      const page: AgentLog[] = [...response.data].reverse();
      setLogs((current) => (before ? [...page, ...current] : page));
      setHasOlder(response.data.length === PAGE_SIZE);
      setError('');
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fetchOlder = () => fetchLogs(logs[0]?.createdAt);

  useEffect(() => {
    fetchLogs();
  }, [agent]);

  useEffect(() => {
    const source = new EventSource(`${BASE_URL}${End_Points.Agent_Logs_Stream_Endpoint()}`, { withCredentials: true });

    source.onmessage = (event) => {
      try {
        const entry: AgentLog = JSON.parse(event.data);
        if (agent && entry.agent !== agent) return;
        setLogs((current) =>
          current.some((line) => line.id === entry.id) ? current : [...current, entry].slice(-MAX_LINES),
        );
      } catch {
        return;
      }
    };

    return () => source.close();
  }, [agent]);

  return { logs, loading, hasOlder, error, fetchOlder };
};
