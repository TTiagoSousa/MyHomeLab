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
const MAX_LINES = 2000;

const withNewLine = <T extends { logs: AgentLog[]; hasOlder: boolean }>(current: T, entry: AgentLog): T => {
  const logs = [...current.logs, entry];
  return logs.length > MAX_LINES ? { ...current, logs: logs.slice(-MAX_LINES), hasOlder: true } : { ...current, logs };
};

export const useAgentLogs = (agent: string | null) => {
  const [view, setView] = useState<{ agent: string | null; logs: AgentLog[]; hasOlder: boolean; error: string }>({ agent, logs: [], hasOlder: false, error: '' });
  const [loading, setLoading] = useState(false);

  const fetchLogs = async (before?: string) => {
    setLoading(true);
    try {
      const response = await http.get(End_Points.Agent_Logs_Endpoint(), {
        params: { agent: agent ?? undefined, before, limit: PAGE_SIZE },
        withCredentials: true,
      });
      const page: AgentLog[] = [...response.data].reverse();
      setView((current) =>
        current.agent === agent
          ? { agent, logs: before ? [...page, ...current.logs] : page, hasOlder: response.data.length === PAGE_SIZE, error: '' }
          : current,
      );
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setView((current) => (current.agent === agent ? { ...current, error: msg } : current));
    } finally {
      setLoading(false);
    }
  };

  const fetchOlder = () => fetchLogs(view.logs[0]?.createdAt);

  useEffect(() => {
    setView({ agent, logs: [], hasOlder: false, error: '' });
    fetchLogs();
  }, [agent]);

  useEffect(() => {
    const source = new EventSource(`${BASE_URL}${End_Points.Agent_Logs_Stream_Endpoint()}`, { withCredentials: true });

    source.onmessage = (event) => {
      try {
        const entry: AgentLog = JSON.parse(event.data);
        if (agent && entry.agent !== agent) return;
        setView((current) =>
          current.agent !== agent || current.logs.some((line) => line.id === entry.id)
            ? current
            : withNewLine(current, entry),
        );
      } catch {
        return;
      }
    };

    return () => source.close();
  }, [agent]);

  return { logs: view.logs, loading, hasOlder: view.hasOlder, error: view.error, fetchOlder };
};
