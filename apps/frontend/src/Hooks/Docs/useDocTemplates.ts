import { useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import type { DocTemplateSet } from './docTypes';

export const useDocTemplates = () => {
  const [sets, setSets] = useState<DocTemplateSet[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSets = async () => {
    setLoading(true);
    try {
      const response = await http.get(End_Points.Docs_Templates_Endpoint(), { withCredentials: true });
      setSets(response.data);
    } catch {
      setSets([]);
    } finally {
      setLoading(false);
    }
  };

  return { sets, loading, fetchSets };
};
