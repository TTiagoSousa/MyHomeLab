import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import type { ServerCheck } from "./useServers";

export const useServerCheck = (serverId: string | undefined, updatedAt?: string) => {
  const [check, setCheck] = useState<ServerCheck | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCheck = async () => {
    if (!serverId) return;
    setLoading(true);
    try {
      const response = await http.get(End_Points.Server_Check_Endpoint(serverId), { withCredentials: true });
      setCheck(response.data);
    } catch (error: any) {
      setCheck({ ok: false, error: error.response?.data?.message || error.message || i18n.t('common:errors.generic') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCheck();
  }, [serverId, updatedAt]);

  return { check, loading, fetchCheck };
};
