import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { docErrorMessage } from "./docErrorMessage";
import type { DocUserType } from "./docTypes";

export const useDocTypes = () => {
  const [types, setTypes] = useState<DocUserType[]>([]);
  const [saving, setSaving] = useState(false);
  const { setAlert } = useAlert();

  const fetchTypes = async () => {
    try {
      const response = await http.get(End_Points.Docs_Types_Endpoint(), { withCredentials: true });
      setTypes(response.data);
    } catch {
      setTypes([]);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  const createType = async (name: string): Promise<DocUserType | null> => {
    setSaving(true);
    try {
      const response = await http.post(End_Points.Docs_Types_Endpoint(), { name }, { withCredentials: true });
      await fetchTypes();
      setAlert({ open: true, message: i18n.t('docs:types.created', { name: response.data.name }), type: 'success' });
      return response.data;
    } catch (error: any) {
      setAlert({ open: true, message: docErrorMessage(error), type: 'error' });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const deleteType = async (id: string) => {
    setSaving(true);
    try {
      await http.delete(End_Points.Docs_Type_Endpoint(id), { withCredentials: true });
      await fetchTypes();
      return true;
    } catch (error: any) {
      setAlert({ open: true, message: docErrorMessage(error), type: 'error' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { types, saving, fetchTypes, createType, deleteType };
};
