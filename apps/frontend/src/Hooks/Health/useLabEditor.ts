import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { healthErrorMessage } from "./healthErrors";
import type { LabAnalyte, LabDraft, LabReportPayload } from "./healthTypes";

export const useLabEditor = () => {
  const [analytes, setAnalytes] = useState<LabAnalyte[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const { setAlert } = useAlert();

  const fetchAnalytes = async () => {
    try {
      const response = await http.get(End_Points.Health_Lab_Analytes_Endpoint(), { withCredentials: true });
      setAnalytes(response.data);
    } catch {
      setAnalytes([]);
    }
  };

  useEffect(() => {
    fetchAnalytes();
  }, []);

  const extract = async (file: File): Promise<{ draft: LabDraft | null; error: string | null }> => {
    setExtracting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await http.post(End_Points.Health_Labs_Extract_Endpoint(), form, { withCredentials: true });
      return { draft: response.data, error: null };
    } catch (error: any) {
      return { draft: null, error: healthErrorMessage(error) };
    } finally {
      setExtracting(false);
    }
  };

  const saveReport = async (
    payload: LabReportPayload,
    options: { id?: string; file?: File | null },
  ): Promise<{ id: string | null; error: string | null }> => {
    setSaving(true);
    try {
      const response = options.id
        ? await http.put(End_Points.Health_Lab_By_Id_Endpoint(options.id), payload, { withCredentials: true })
        : await http.post(End_Points.Health_Labs_Endpoint(), payload, { withCredentials: true });
      const id: string = response.data.id;
      if (options.file) {
        const form = new FormData();
        form.append('file', options.file);
        await http.post(End_Points.Health_Lab_Pdf_Endpoint(id), form, { withCredentials: true });
      }
      setAlert({ open: true, message: i18n.t('health:labs.saved'), type: 'success' });
      return { id, error: null };
    } catch (error: any) {
      return { id: null, error: healthErrorMessage(error) };
    } finally {
      setSaving(false);
    }
  };

  return { analytes, extracting, saving, extract, saveReport };
};
