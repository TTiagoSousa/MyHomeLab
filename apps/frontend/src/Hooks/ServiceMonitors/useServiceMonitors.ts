import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { announceNotificationsChanged } from "../Notifications/useNotifications";

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

const monitorErrorMessage = (error: any): string => {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  return message || error?.message || i18n.t('common:errors.generic');
};

export const useServiceMonitors = () => {
  const [monitors, setMonitors] = useState<ServiceMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const { setAlert } = useAlert();

  const fetchMonitors = async () => {
    try {
      const response = await http.get(End_Points.Service_Monitors_Endpoint(), { withCredentials: true });
      setMonitors(response.data);
    } catch {
      setMonitors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitors();

    const timer = setInterval(fetchMonitors, REFRESH_MS);
    return () => clearInterval(timer);
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

  const checkMonitor = async (id: string) => {
    setCheckingId(id);
    try {
      await http.post(End_Points.Service_Monitor_Check_Endpoint(id), {}, { withCredentials: true });
      await fetchMonitors();
      announceNotificationsChanged();
    } catch (error: any) {
      setAlert({ open: true, message: monitorErrorMessage(error), type: 'error' });
    } finally {
      setCheckingId(null);
    }
  };

  return { monitors, loading, saving, checkingId, fetchMonitors, saveMonitor, removeMonitor, checkMonitor };
};
