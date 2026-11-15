import { useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";

export const useTaskConversation = () => {
  const [opening, setOpening] = useState(false);
  const { setAlert } = useAlert();

  const openTaskConversation = async (taskId: string): Promise<string | null> => {
    setOpening(true);
    try {
      const response = await http.post(End_Points.Assistant_Task_Conversation_Endpoint(taskId), {}, { withCredentials: true });
      return response.data.id;
    } catch (error: any) {
      setAlert({ open: true, message: error.response?.data?.message || error.message || i18n.t('common:errors.generic'), type: 'error' });
      return null;
    } finally {
      setOpening(false);
    }
  };

  return { opening, openTaskConversation };
};
