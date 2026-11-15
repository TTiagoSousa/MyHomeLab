import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import type { UpdateAttemptSummary } from "./updateAttemptTypes";

export const useUpdateAttempts = (accountId?: string) => {
  const [attempts, setAttempts] = useState<UpdateAttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAttempts = async () => {
    try {
      const response = await http.get(End_Points.Update_Attempts_Endpoint(), {
        params: accountId ? { accountId } : undefined,
        withCredentials: true,
      });
      setAttempts(response.data);
      setError('');
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttempts();
  }, [accountId]);

  return { attempts, loading, error, fetchAttempts };
};
