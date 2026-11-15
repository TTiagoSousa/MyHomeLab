import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";

export type DiskStatus = 'ok' | 'warning' | 'problem' | 'unknown';

export interface DiskIssue {
  level: 'problem' | 'warning';
  text: string;
}

export interface DiskHistoryPoint {
  day: string;
  temperature: number | null;
  wearout: number | null;
  reallocated: number | null;
  pending: number | null;
  mediaErrors: number | null;
}

export interface ServerDisk {
  key: string;
  devPath: string;
  model: string | null;
  serial: string | null;
  type: string | null;
  sizeBytes: number | null;
  health: string | null;
  wearout: number | null;
  temperature: number | null;
  reallocated: number | null;
  pending: number | null;
  mediaErrors: number | null;
  powerOnHours: number | null;
  status: DiskStatus;
  issues: DiskIssue[];
  history: DiskHistoryPoint[];
}

export interface ZfsPool {
  name: string;
  health: string;
  size: number;
  alloc: number;
  status: DiskStatus;
  issues: DiskIssue[];
}

export interface NodeDisks {
  node: string;
  error: string | null;
  disks: ServerDisk[];
  pools: ZfsPool[];
}

export interface DisksOverview {
  checkedAt: string;
  nodes: NodeDisks[];
}

export const useServerDisks = (serverId: string) => {
  const [overview, setOverview] = useState<DisksOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDisks = async () => {
    setLoading(true);
    try {
      const response = await http.get(End_Points.Server_Disks_Endpoint(serverId), { withCredentials: true });
      setOverview(response.data);
      setError('');
    } catch (error: any) {
      setError(error?.response?.data?.message || error?.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisks();
  }, [serverId]);

  return { overview, loading, error, fetchDisks };
};
