import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { healthErrorMessage } from "./healthErrors";
import type { HealthCondition, HealthConditionPayload } from "./healthTypes";

export const useHealthConditions = () => {
  const [conditions, setConditions] = useState<HealthCondition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { setAlert } = useAlert();

  const fetchConditions = async () => {
    try {
      const response = await http.get(End_Points.Health_Conditions_Endpoint(), { withCredentials: true });
      setConditions(response.data);
    } catch (error: any) {
      setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConditions();
  }, []);

  const saveCondition = async (payload: HealthConditionPayload, id?: string): Promise<string | null> => {
    setSaving(true);
    try {
      if (id) {
        await http.put(End_Points.Health_Condition_By_Id_Endpoint(id), payload, { withCredentials: true });
      } else {
        await http.post(End_Points.Health_Conditions_Endpoint(), payload, { withCredentials: true });
      }
      setAlert({ open: true, message: i18n.t('health:conditions.saved'), type: 'success' });
      await fetchConditions();
      return null;
    } catch (error: any) {
      return healthErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const removeCondition = async (id: string) => {
    try {
      await http.delete(End_Points.Health_Condition_By_Id_Endpoint(id), { withCredentials: true });
      setAlert({ open: true, message: i18n.t('health:conditions.removed'), type: 'success' });
      await fetchConditions();
    } catch (error: any) {
      setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });
    }
  };

  return { conditions, loading, saving, saveCondition, removeCondition };
};
