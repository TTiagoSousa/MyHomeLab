import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import { ATTEMPT_OPEN, type UpdateAttempt } from "./updateAttemptTypes";

const REFRESH_MS = 10_000;

export const useUpdateAttempt = (attemptId: string | undefined) => {
  const [attempt, setAttempt] = useState<UpdateAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAttempt = async () => {
    if (!attemptId) return;
    try {
      const response = await http.get(End_Points.Update_Attempt_Endpoint(attemptId), { withCredentials: true });
      setAttempt(response.data);
      setError('');
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttempt();
  }, [attemptId]);

  useEffect(() => {
    if (!attempt || !ATTEMPT_OPEN.includes(attempt.status)) return;
    const timer = setInterval(fetchAttempt, REFRESH_MS);
    return () => clearInterval(timer);
  }, [attempt?.id, attempt?.status]);

  return { attempt, loading, error, fetchAttempt };
};
