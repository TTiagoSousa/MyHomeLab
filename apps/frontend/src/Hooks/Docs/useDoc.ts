import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { docErrorMessage } from "./docErrorMessage";
import type { Doc, DocPayload, DocVersion } from "./docTypes";

export const useDoc = (docId: string | undefined) => {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { setAlert } = useAlert();

  const fetchDoc = async () => {
    if (!docId) {
      setDoc(null);
      return;
    }
    setLoading(true);
    try {
      const response = await http.get(End_Points.Doc_By_Id_Endpoint(docId), { withCredentials: true });
      setDoc(response.data);
      setError('');
    } catch (error: any) {
      setDoc(null);
      setError(docErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoc();
  }, [docId]);

  const saveDoc = async (payload: DocPayload) => {
    if (!docId) return false;
    setSaving(true);
    try {
      await http.patch(End_Points.Doc_By_Id_Endpoint(docId), payload, { withCredentials: true });
      await fetchDoc();
      setAlert({ open: true, message: i18n.t('docs:alerts.saved'), type: 'success' });
      return true;
    } catch (error: any) {
      setAlert({ open: true, message: docErrorMessage(error), type: 'error' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteDoc = async () => {
    if (!docId) return false;
    setSaving(true);
    try {
      await http.delete(End_Points.Doc_By_Id_Endpoint(docId), { withCredentials: true });
      setAlert({ open: true, message: i18n.t('docs:alerts.deleted'), type: 'success' });
      return true;
    } catch (error: any) {
      setAlert({ open: true, message: docErrorMessage(error), type: 'error' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const fetchVersion = async (versionId: string): Promise<DocVersion | null> => {
    if (!docId) return null;
    try {
      const response = await http.get(End_Points.Doc_Version_Endpoint(docId, versionId), { withCredentials: true });
      return response.data;
    } catch (error: any) {
      setAlert({ open: true, message: docErrorMessage(error), type: 'error' });
      return null;
    }
  };

  const restoreVersion = async (versionId: string) => {
    if (!docId) return false;
    setSaving(true);
    try {
      await http.post(End_Points.Doc_Version_Restore_Endpoint(docId, versionId), {}, { withCredentials: true });
      await fetchDoc();
      setAlert({ open: true, message: i18n.t('docs:alerts.restored'), type: 'success' });
      return true;
    } catch (error: any) {
      setAlert({ open: true, message: docErrorMessage(error), type: 'error' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const [checking, setChecking] = useState(false);

  const checkConflicts = async () => {
    if (!docId) return;
    setChecking(true);
    try {
      const response = await http.post(End_Points.Doc_Check_Conflicts_Endpoint(docId), {}, { withCredentials: true });
      await fetchDoc();
      setAlert({
        open: true,
        message: response.data.length ? i18n.t('docs:conflicts.found', { count: response.data.length }) : i18n.t('docs:conflicts.none'),
        type: response.data.length ? 'warning' : 'success',
      });
    } catch (error: any) {
      setAlert({ open: true, message: docErrorMessage(error), type: 'error' });
    } finally {
      setChecking(false);
    }
  };

  return { doc, loading, saving, error, checking, fetchDoc, saveDoc, deleteDoc, fetchVersion, restoreVersion, checkConflicts };
};
