import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { todoErrorMessage } from "./todoErrorMessage";
import type { TodoList } from "./todoTypes";

export const useTodoLists = () => {
  const [lists, setLists] = useState<TodoList[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { setAlert } = useAlert();

  const fetchLists = async () => {
    try {
      const response = await http.get(End_Points.Todo_Lists_Endpoint(), { withCredentials: true });
      setLists(response.data);
    } catch (error: any) {
      setAlert({ open: true, message: todoErrorMessage(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, []);

  const createList = async (name: string): Promise<TodoList | null> => {
    setSaving(true);
    try {
      const response = await http.post(End_Points.Todo_Lists_Endpoint(), { name }, { withCredentials: true });
      await fetchLists();
      setAlert({ open: true, message: i18n.t('todos:alerts.listCreated', { name: response.data.name }), type: 'success' });
      return response.data;
    } catch (error: any) {
      setAlert({ open: true, message: todoErrorMessage(error), type: 'error' });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const renameList = async (id: string, name: string) => {
    setSaving(true);
    try {
      await http.patch(End_Points.Todo_List_Endpoint(id), { name }, { withCredentials: true });
      await fetchLists();
      return true;
    } catch (error: any) {
      setAlert({ open: true, message: todoErrorMessage(error), type: 'error' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteList = async (id: string) => {
    setSaving(true);
    try {
      await http.delete(End_Points.Todo_List_Endpoint(id), { withCredentials: true });
      await fetchLists();
      setAlert({ open: true, message: i18n.t('todos:alerts.listDeleted'), type: 'success' });
      return true;
    } catch (error: any) {
      setAlert({ open: true, message: todoErrorMessage(error), type: 'error' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { lists, loading, saving, fetchLists, createList, renameList, deleteList };
};
