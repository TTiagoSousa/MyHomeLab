import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";

export interface DashboardNode {
  name: string;
  status: string;
  cpu: number;
  cpus: number;
  cpuModel: string | null;
  memUsed: number;
  memTotal: number;
  swapUsed: number;
  swapTotal: number;
  rootUsed: number;
  rootTotal: number;
  uptime: number;
  loadavg: number[];
  kernel: string | null;
}

export interface DashboardStorage {
  name: string;
  node: string;
  type: string;
  used: number;
  total: number;
  active: boolean;
  shared: boolean;
  content: string[];
}

export interface DashboardGuest {
  vmid: number;
  name: string;
  type: 'qemu' | 'lxc';
  node: string;
  status: string;
  cpu: number;
  cpus: number;
  memUsed: number;
  memTotal: number;
  diskUsed: number;
  diskTotal: number;
  netIn: number;
  netOut: number;
  uptime: number;
}

export interface ServerDashboard {
  version: string;
  fetchedAt: string;
  nodes: DashboardNode[];
  storages: DashboardStorage[];
  guests: DashboardGuest[];
}

const REFRESH_MS = 30_000;

export const useServerDashboard = (serverId: string | null) => {
  const [view, setView] = useState<{ serverId: string | null; dashboard: ServerDashboard | null; error: string }>({ serverId, dashboard: null, error: '' });
  const [loading, setLoading] = useState(false);

  const showForServer = (requestedId: string, next: { dashboard?: ServerDashboard; error: string }) =>
    setView((current) => (current.serverId === requestedId ? { ...current, ...next } : current));

  const fetchDashboard = async () => {
    if (!serverId) return;

    setLoading(true);
    try {
      const response = await http.get(End_Points.Server_Dashboard_Endpoint(serverId), { withCredentials: true });
      showForServer(serverId, { dashboard: response.data, error: '' });
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      showForServer(serverId, { error: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setView({ serverId, dashboard: null, error: '' });
    fetchDashboard();

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') fetchDashboard();
    };
    const timer = setInterval(refreshIfVisible, REFRESH_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [serverId]);

  return { dashboard: view.dashboard, loading, error: view.error, fetchDashboard };
};
