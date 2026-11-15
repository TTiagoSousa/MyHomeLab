import { useCallback, useEffect, useRef, useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import { BASE_URL } from '../../config/urls';
import i18n from '../../i18n';

export type AgentStatus = 'IDLE' | 'ACTIVE';
export type AgentModel = 'OPUS' | 'SONNET';
export type AgentEffort = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AgentConfig {
  name: string;
  description: string;
  prompt: string;
  extraPrompt: string | null;
  model: AgentModel;
  effort: AgentEffort;
  tools: string[];
  reportsToId: string | null;
  color: number;
  isActive: boolean;
}

export interface Agent extends AgentConfig {
  id: string;
  agent: string;
  key: string;
  template: string | null;
  isRoot: boolean;
  defaultPrompt: string | null;
  promptEdited: boolean;
  status: AgentStatus;
  action: string | null;
  since: string | null;
  lastActiveAt: string | null;
}

export const useAgents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);
  const [error, setError] = useState('');
  const sourceRef = useRef<EventSource | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get(End_Points.Agent_Endpoint(), {
        withCredentials: true,
      });
      setAgents(response.data);
      setError('');
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    const source = new EventSource(`${BASE_URL}${End_Points.Agent_Stream_Endpoint()}`, {
      withCredentials: true,
    });
    sourceRef.current = source;

    source.onopen = () => setLive(true);

    source.onmessage = (event) => {
      try {
        const activity: Pick<Agent, 'agent' | 'status' | 'action' | 'since' | 'lastActiveAt'>[] =
          JSON.parse(event.data);
        setAgents((current) =>
          current.map((agent) => {
            const update = activity.find((entry) => entry.agent === agent.agent);
            return update ? { ...agent, ...update } : agent;
          }),
        );
      } catch {
        return;
      }
    };

    source.onerror = () => setLive(false);

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, []);

  return { agents, loading, live, error, fetchAgents, setAgents };
};
