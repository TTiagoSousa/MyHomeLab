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
  const [dashboard, setDashboard] = useState<ServerDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchDashboard = async () => {
    if (!serverId) return;

    setLoading(true);
    try {
      const response = await http.get(End_Points.Server_Dashboard_Endpoint(serverId), { withCredentials: true });
      setDashboard(response.data);
      setError('');
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDashboard(null);
    setError('');
    fetchDashboard();

    const timer = setInterval(fetchDashboard, REFRESH_MS);
    return () => clearInterval(timer);
  }, [serverId]);

  return { dashboard, loading, error, fetchDashboard };
};
