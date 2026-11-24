import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { healthErrorMessage } from "./healthErrors";
import type { HealthForm, HealthFormField, HealthFormLayout } from "./healthTypes";

export interface HealthFormDraft {
  name: string;
  fields: HealthFormField[];
  layout: HealthFormLayout;
}

export interface HealthFormSubmission {
  values: Partial<Record<HealthFormField, number>>;
  deviceId: string | null;
  measuredAt: string;
  timeZone: string;
}

export const useHealthForms = () => {
  const [forms, setForms] = useState<HealthForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { setAlert } = useAlert();

  const fetchForms = async () => {
    try {
      const response = await http.get(End_Points.Health_Forms_Endpoint(), { withCredentials: true });
      setForms(response.data);
    } catch {
      setForms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForms();
  }, []);

  const saveForm = async (draft: HealthFormDraft, id?: string): Promise<string | null> => {
    setSaving(true);
    try {
      if (id) await http.put(End_Points.Health_Form_Endpoint(id), draft, { withCredentials: true });
      else await http.post(End_Points.Health_Forms_Endpoint(), draft, { withCredentials: true });
      await fetchForms();
      return null;
    } catch (error: any) {
      return healthErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const removeForm = async (id: string) => {
    try {
      await http.delete(End_Points.Health_Form_Endpoint(id), { withCredentials: true });
      setForms((current) => current.filter((form) => form.id !== id));
    } catch (error: any) {
      setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });
    }
  };

  const submitForm = async (id: string, submission: HealthFormSubmission): Promise<string | null> => {
    setSaving(true);
    try {
      await http.post(End_Points.Health_Form_Entries_Endpoint(id), submission, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('health:forms.saved'), type: 'success' });
      return null;
    } catch (error: any) {
      return healthErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  return { forms, loading, saving, saveForm, removeForm, submitForm };
};
