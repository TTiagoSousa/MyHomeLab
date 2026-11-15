import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { healthErrorMessage } from "./healthErrors";
import type { Medication, MedicationPayload } from "./healthTypes";

export const useMedications = () => {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setAlert } = useAlert();

  const fetchMedications = async () => {
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Medications_Endpoint(), { withCredentials: true });
      setMedications(response.data);
    } catch (error: any) {
      setError(healthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedications();
  }, []);

  const saveMedication = async (payload: MedicationPayload, id?: string): Promise<string | null> => {
    setSaving(true);
    try {
      if (id) {
        await http.put(End_Points.Health_Medication_By_Id_Endpoint(id), payload, { withCredentials: true });
      } else {
        await http.post(End_Points.Health_Medications_Endpoint(), payload, { withCredentials: true });
      }
      setAlert({ open: true, message: i18n.t('health:medication.saved'), type: 'success' });
      await fetchMedications();
      return null;
    } catch (error: any) {
      return healthErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const stopMedication = async (id: string, payload: MedicationPayload) => {
    setSaving(true);
    try {
      await http.put(End_Points.Health_Medication_By_Id_Endpoint(id), payload, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('health:medicationStatus.stopped'), type: 'success' });
      await fetchMedications();
    } catch (error: any) {
      setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const removeMedication = async (id: string) => {
    try {
      await http.delete(End_Points.Health_Medication_By_Id_Endpoint(id), { withCredentials: true });
      await fetchMedications();
    } catch (error: any) {
      setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });
    }
  };

  return { medications, loading, saving, error, saveMedication, stopMedication, removeMedication };
};
