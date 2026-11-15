import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { aiErrorMessage } from "./useAiProviders";

export const useAiModels = (provider: string) => {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchModels = async () => {
    setLoading(true);
    try {
      const response = await http.get(End_Points.Ai_Provider_Models_Endpoint(provider), { withCredentials: true });
      setModels(response.data);
      setError('');
    } catch (error: any) {
      setError(aiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, [provider]);

  return { models, loading, error };
};
