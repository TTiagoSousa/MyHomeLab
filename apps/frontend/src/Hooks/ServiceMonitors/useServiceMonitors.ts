import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { announceNotificationsChanged } from "../Notifications/useNotifications";
import { useCheckMonitor } from "./useCheckMonitor";
import { monitorErrorMessage } from "./monitorErrorMessage";

export type MonitorKind = 'HTTP' | 'TCP';
export type MonitorStatus = 'UNKNOWN' | 'UP' | 'DOWN';

export interface ServiceMonitor {
  id: string;
  name: string;
  kind: MonitorKind;
  target: string;
  intervalMinutes: number;
  server: { id: string; name: string } | null;
  guestVmid: number | null;
  guestName: string | null;
  guestMissing: boolean;
  app: { id: string; name: string } | null;
  downTaskId: string | null;
  status: MonitorStatus;
  lastCheckedAt: string | null;
  lastLatencyMs: number | null;
  lastError: string | null;
}

export interface ServiceMonitorPayload {
  name: string;
  kind: MonitorKind;
  target: string;
  intervalMinutes: number;
  serverConnectionId: string | null;
  guestVmid: number | null;
  guestName: string | null;
}

const REFRESH_MS = 30_000;

export const useServiceMonitors = () => {
  const [monitors, setMonitors] = useState<ServiceMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { setAlert } = useAlert();

  const fetchMonitors = async () => {
    try {
      const response = await http.get(End_Points.Service_Monitors_Endpoint(), { withCredentials: true });
      setMonitors(response.data);
      setError('');
    } catch (error: any) {
      setError(monitorErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const { checkingId, checkMonitor } = useCheckMonitor(fetchMonitors);

  useEffect(() => {
    fetchMonitors();

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') fetchMonitors();
    };
    const timer = setInterval(refreshIfVisible, REFRESH_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, []);

  const saveMonitor = async (payload: ServiceMonitorPayload, id?: string): Promise<string | null> => {
    setSaving(true);
    try {
      if (id) {
        await http.put(End_Points.Service_Monitor_By_Id_Endpoint(id), payload, { withCredentials: true });
      } else {
        await http.post(End_Points.Service_Monitors_Endpoint(), payload, { withCredentials: true });
      }
      await fetchMonitors();
      announceNotificationsChanged();
      setAlert({ open: true, message: i18n.t('servers:monitors.saved'), type: 'success' });
      return null;
    } catch (error: any) {
      return monitorErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const removeMonitor = async (id: string) => {
    try {
      await http.delete(End_Points.Service_Monitor_By_Id_Endpoint(id), { withCredentials: true });
      await fetchMonitors();
      announceNotificationsChanged();
    } catch (error: any) {
      setAlert({ open: true, message: monitorErrorMessage(error), type: 'error' });
    }
  };

  return { monitors, loading, error, saving, checkingId, fetchMonitors, saveMonitor, removeMonitor, checkMonitor };
};
