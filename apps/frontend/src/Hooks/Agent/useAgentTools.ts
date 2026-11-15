import { useEffect, useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import i18n from '../../i18n';

export interface AgentToolOption {
  name: string;
  group: string;
  access: 'read' | 'write';
}

export const useAgentTools = () => {
  const [tools, setTools] = useState<AgentToolOption[]>([]);
  const [error, setError] = useState('');

  const fetchTools = async () => {
    try {
      const response = await http.get(End_Points.Agent_Tools_Endpoint(), { withCredentials: true });
      setTools(response.data);
      setError('');
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || i18n.t('common:errors.generic'));
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  return { tools, error, fetchTools };
};
