import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";

export interface ServerUpdates {
  nodes: { node: string; updates: number; error?: string }[];
  total: number;
  pve: { from: string; to: string } | null;
  packages: { name: string; from: string | null; to: string }[];
}

export const useServerUpdates = (serverId: string | undefined) => {
  const [updates, setUpdates] = useState<ServerUpdates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchUpdates = async () => {
    if (!serverId) return;
    setLoading(true);
    try {
      const response = await http.get(End_Points.Server_Updates_Endpoint(serverId), { withCredentials: true });
      setUpdates(response.data);
      setError('');
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdates();
  }, [serverId]);

  return { updates, loading, error, fetchUpdates };
};
