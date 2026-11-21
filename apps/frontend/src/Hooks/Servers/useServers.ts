import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";

export interface ServerEntry {
  id: string;
  kind: string;
  name: string;
  host: string;
  port: number;
  tokenId: string;
  verifyTls: boolean;
  updatedAt: string;
  sshEnabled: boolean;
  sshUser: string | null;
  sshPort: number;
  sshPublicKey: string | null;
  sshHostKey: string | null;
  sshHostKeyAt: string | null;
}

export interface ServerPayload {
  name: string;
  host: string;
  port: number;
  tokenId: string;
  tokenSecret?: string;
  verifyTls: boolean;
}

export interface ServerCheck {
  ok: boolean;
  version?: string;
  nodes?: number;
  guests?: number;
  running?: number;
  error?: string;
}

const SERVERS_CHANGED = 'myhomelab:servers-changed';

const serverErrorMessage = (error: any): string => {
  const data = error?.response?.data;
  if (data?.code && i18n.exists(`settings:servers.errors.${data.code}`)) {
    return i18n.t(`settings:servers.errors.${data.code}`);
  }
  const message = Array.isArray(data?.message) ? data.message.join(' ') : data?.message;
  return message || error?.message || i18n.t('common:errors.generic');
};

export const useServers = () => {
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { setAlert } = useAlert();

  const fetchServers = async () => {
    try {
      const response = await http.get(End_Points.Servers_Endpoint(), { withCredentials: true });
      setServers(response.data);
    } catch {
      setServers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();

    window.addEventListener(SERVERS_CHANGED, fetchServers);
    return () => window.removeEventListener(SERVERS_CHANGED, fetchServers);
  }, []);

  const saveServer = async (payload: ServerPayload, id?: string): Promise<string | null> => {
    setSaving(true);
    try {
      const body = { ...payload, tokenSecret: payload.tokenSecret || undefined };

      if (id) {
        await http.patch(End_Points.Server_By_Id_Endpoint(id), body, { withCredentials: true });
      } else {
        await http.post(End_Points.Servers_Endpoint(), body, { withCredentials: true });
      }

      window.dispatchEvent(new Event(SERVERS_CHANGED));
      setAlert({ open: true, message: i18n.t('settings:servers.saved'), type: 'success' });
      return null;
    } catch (error: any) {
      return serverErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const removeServer = async (id: string, force = false): Promise<string[] | null> => {
    try {
      await http.delete(End_Points.Server_By_Id_Endpoint(id), { params: force ? { force: true } : undefined, withCredentials: true });
      window.dispatchEvent(new Event(SERVERS_CHANGED));
      setAlert({ open: true, message: i18n.t('settings:servers.removed'), type: 'success' });
      return null;
    } catch (error: any) {
      if (error.response?.data?.code === 'SERVER_HAS_SERVICES') return error.response.data.services;
      setAlert({ open: true, message: serverErrorMessage(error), type: 'error' });
      return null;
    }
  };

  const checkServer = async (id: string): Promise<ServerCheck> => {
    try {
      const response = await http.get(End_Points.Server_Check_Endpoint(id), { withCredentials: true });
      return response.data;
    } catch (error: any) {
      return { ok: false, error: serverErrorMessage(error) };
    }
  };

  const refreshServers = () => window.dispatchEvent(new Event(SERVERS_CHANGED));

  return { servers, loading, saving, fetchServers, saveServer, removeServer, checkServer, refreshServers };
};
