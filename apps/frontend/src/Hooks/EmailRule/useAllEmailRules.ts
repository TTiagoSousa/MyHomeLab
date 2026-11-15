import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import type { EmailRule } from "./useEmailRules";

export const useAllEmailRules = (accountIds: string[]) => {
  const [emailRules, setEmailRules] = useState<EmailRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const key = accountIds.join(',');

  const fetchEmailRules = async () => {
    if (!accountIds.length) return;
    setLoading(true);
    try {
      const responses = await Promise.all(
        accountIds.map((accountId) => http.get(End_Points.Email_Rule_Endpoint(accountId), { withCredentials: true })),
      );
      setEmailRules(responses.flatMap((response) => response.data));
      setError('');
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmailRules();
  }, [key]);

  return { emailRules, loading, error, fetchEmailRules };
};
