import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  lastMessageAt: string;
  taskId: string | null;
  taskKey: string | null;
}

const errorMessage = (error: any) => error.response?.data?.message || error.message || i18n.t('common:errors.generic');

export const useConversations = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { setAlert } = useAlert();

  const fetchConversations = async () => {
    try {
      const response = await http.get(End_Points.Assistant_Conversations_Endpoint(), { withCredentials: true });
      setConversations(response.data);
    } catch (error: any) {
      setAlert({ open: true, message: errorMessage(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  const renameConversation = async (id: string, title: string) => {
    try {
      await http.patch(End_Points.Assistant_Conversation_Endpoint(id), { title }, { withCredentials: true });
      await fetchConversations();
      return true;
    } catch (error: any) {
      setAlert({ open: true, message: errorMessage(error), type: 'error' });
      return false;
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      await http.delete(End_Points.Assistant_Conversation_Endpoint(id), { withCredentials: true });
      await fetchConversations();
      return true;
    } catch (error: any) {
      setAlert({ open: true, message: errorMessage(error), type: 'error' });
      return false;
    }
  };

  return { conversations, loading, fetchConversations, renameConversation, deleteConversation };
};
