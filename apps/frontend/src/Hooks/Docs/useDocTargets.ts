import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { docErrorMessage } from "./docErrorMessage";
import type { DocTarget } from "./docTypes";

export const useDocTargets = () => {
  const [targets, setTargets] = useState<DocTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTargets = async () => {
    try {
      const response = await http.get(End_Points.Doc_Targets_Endpoint(), { withCredentials: true });
      setTargets(response.data);
      setError('');
    } catch (error: any) {
      setError(docErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTargets();
  }, []);

  return { targets, loading, error, fetchTargets };
};
