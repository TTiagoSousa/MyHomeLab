import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";

export interface UsageGroup {
  key: string;
  tokensIn: number;
  tokensOut: number;
  cacheRead: number;
  cost: number;
}

export interface AiUsage {
  month: string;
  total: number;
  budget: number | null;
  byAgent: UsageGroup[];
  bySource: UsageGroup[];
  byDay: UsageGroup[];
}

const errorMessage = (error: any) => error.response?.data?.message || error.message || i18n.t('common:errors.generic');

export const useAiUsage = () => {
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [saving, setSaving] = useState(false);
  const { setAlert } = useAlert();

  const fetchUsage = async () => {
    try {
      const response = await http.get(End_Points.Ai_Usage_Endpoint(), { withCredentials: true });
      setUsage(response.data);
    } catch {
      setUsage(null);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, []);

  const saveBudget = async (monthlyBudget: number | null) => {
    setSaving(true);
    try {
      const response = await http.put(End_Points.Ai_Usage_Budget_Endpoint(), { monthlyBudget }, { withCredentials: true });
      setUsage(response.data);
      setAlert({ open: true, message: i18n.t('settings:usage.saved'), type: 'success' });
    } catch (error: any) {
      setAlert({ open: true, message: errorMessage(error), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return { usage, saving, saveBudget };
};
