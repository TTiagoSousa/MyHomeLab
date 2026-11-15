import { useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import { useAlert } from '../../Contexts/Alert_Context';
import i18n from '../../i18n';
import type { Agent, AgentConfig } from './useAgents';

export const useTeamAgent = () => {
  const [saving, setSaving] = useState(false);
  const { setAlert } = useAlert();

  const request = async (send: () => Promise<{ data: Agent[] }>, message: string): Promise<Agent[] | null> => {
    setSaving(true);
    try {
      const response = await send();
      setAlert({ open: true, message, type: 'success' });
      return response.data;
    } catch (error: any) {
      const msg = error?.response?.data?.message;
      setAlert({
        open: true,
        message: (Array.isArray(msg) ? msg.join(', ') : msg) || error?.message || i18n.t('common:errors.generic'),
        type: 'error',
      });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const createAgent = (config: AgentConfig) =>
    request(
      () => http.post(End_Points.Agent_Endpoint(), config, { withCredentials: true }),
      i18n.t('assistant:workflow.editor.created'),
    );

  const updateAgent = (id: string, changes: Partial<AgentConfig>) =>
    request(
      () => http.patch(End_Points.Agent_By_Id_Endpoint(id), changes, { withCredentials: true }),
      i18n.t('assistant:workflow.editor.saved'),
    );

  const deleteAgent = (id: string) =>
    request(
      () => http.delete(End_Points.Agent_By_Id_Endpoint(id), { withCredentials: true }),
      i18n.t('assistant:workflow.editor.deleted'),
    );

  return { saving, createAgent, updateAgent, deleteAgent };
};
