import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";

export type NotificationKind = 'SERVICE_DOWN' | 'MACHINE_MISSING' | 'APP_UPDATE' | 'DISK_PROBLEM' | 'DISK_WARNING' | 'CERT_EXPIRED' | 'CERT_EXPIRING' | 'APP_PROBLEM' | 'BACKUP_FAILED' | 'APP_WARNING' | 'AGENT_NOTICE';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  subject: string | null;
  monitorId: string | null;
  connectedAccountId: string | null;
  serverConnectionId: string | null;
  connectedAccount: { provider: string } | null;
  createdAt: string;
  resolvedAt: string | null;
  related?: AppNotification[];
}

export const NOTIFICATIONS_CHANGED = 'myhomelab:notifications-changed';

export const announceNotificationsChanged = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));

export const useNotifications = () => {
  const [active, setActive] = useState<AppNotification[]>([]);
  const [resolved, setResolved] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const { setAlert } = useAlert();

  const fetchNotifications = async () => {
    try {
      const response = await http.get(End_Points.Notifications_Endpoint(), { withCredentials: true });
      setActive(response.data.active);
      setResolved(response.data.resolved);
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    window.addEventListener(NOTIFICATIONS_CHANGED, fetchNotifications);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED, fetchNotifications);
  }, []);

  const clearResolved = async () => {
    try {
      await http.delete(End_Points.Notifications_Resolved_Endpoint(), { withCredentials: true });
      setResolved([]);
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
    }
  };

  const dismiss = async (id: string) => {
    try {
      await http.post(End_Points.Notification_Dismiss_Endpoint(id), {}, { withCredentials: true });
      await fetchNotifications();
      announceNotificationsChanged();
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setAlert({ open: true, message: msg, type: 'error' });
    }
  };

  return { active, resolved, loading, fetchNotifications, clearResolved, dismiss };
};
