import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { healthErrorMessage } from "./healthErrors";
import type { DiaryEntry, DiaryPayload } from "./healthTypes";

export const useHealthDiary = () => {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setAlert } = useAlert();

  const fetchDiary = async () => {
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Diary_Endpoint(), { params: { days: 0 }, withCredentials: true });
      setEntries(response.data);
    } catch (error: any) {
      setError(healthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiary();
  }, []);

  const saveEntry = async (payload: DiaryPayload, id?: string): Promise<string | null> => {
    setSaving(true);
    try {
      if (id) {
        await http.put(End_Points.Health_Diary_By_Id_Endpoint(id), payload, { withCredentials: true });
      } else {
        await http.post(End_Points.Health_Diary_Endpoint(), payload, { withCredentials: true });
      }
      setAlert({ open: true, message: i18n.t('health:diary.saved'), type: 'success' });
      await fetchDiary();
      return null;
    } catch (error: any) {
      return healthErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async (id: string) => {
    try {
      await http.delete(End_Points.Health_Diary_By_Id_Endpoint(id), { withCredentials: true });
      await fetchDiary();
    } catch (error: any) {
      setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });
    }
  };

  return { entries, loading, saving, error, saveEntry, removeEntry };
};
