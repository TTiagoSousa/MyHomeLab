import { useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import { announceNotificationsChanged } from "../Notifications/useNotifications";
import { monitorErrorMessage } from "./monitorErrorMessage";

export const useCheckMonitor = (onChecked?: () => Promise<void>) => {
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const { setAlert } = useAlert();

  const checkMonitor = async (id: string) => {
    setCheckingId(id);
    try {
      await http.post(End_Points.Service_Monitor_Check_Endpoint(id), {}, { withCredentials: true });
      if (onChecked) await onChecked();
      announceNotificationsChanged();
    } catch (error: any) {
      setAlert({ open: true, message: monitorErrorMessage(error), type: 'error' });
    } finally {
      setCheckingId(null);
    }
  };

  return { checkingId, checkMonitor };
};
