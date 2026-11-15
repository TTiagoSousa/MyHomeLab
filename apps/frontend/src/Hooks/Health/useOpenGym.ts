import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import { healthErrorMessage } from "./healthErrors";
import type { OpenGymConnection, OpenGymStatus } from "./healthTypes";
import type { RunFrequency } from "@myhomelab/shared";

export const useOpenGym = () => {
  const [connection, setConnection] = useState<OpenGymConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<OpenGymStatus | null>(null);
  const { setAlert } = useAlert();

  const fetchConnection = async () => {
    try {
      const response = await http.get(End_Points.Health_OpenGym_Endpoint(), { withCredentials: true });
      setConnection(response.data);
      if (response.data.connected) fetchStatus();
    } catch (error: any) {
      setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async () => {
    setStatus(null);
    try {
      const response = await http.get(End_Points.Health_OpenGym_Status_Endpoint(), { withCredentials: true });
      setStatus(response.data);
    } catch (error: any) {
      setStatus({ online: false, error: healthErrorMessage(error) });
    }
  };

  useEffect(() => {
    fetchConnection();
  }, []);

  const connect = async (baseUrl: string, code: string): Promise<string | null> => {
    setBusy(true);
    try {
      const response = await http.post(End_Points.Health_OpenGym_Endpoint(), { baseUrl, code }, { withCredentials: true });
      setConnection(response.data);
      setStatus({ online: true, error: null });
      return null;
    } catch (error: any) {
      return healthErrorMessage(error);
    } finally {
      setBusy(false);
    }
  };

  const connectApp = async (accountId: string): Promise<string | null> => {
    setBusy(true);
    try {
      const response = await http.post(End_Points.Health_OpenGym_App_Endpoint(), { accountId }, { withCredentials: true });
      setConnection(response.data);
      setStatus({ online: true, error: null });
      return null;
    } catch (error: any) {
      return healthErrorMessage(error);
    } finally {
      setBusy(false);
    }
  };

  const updateSettings = async (change: { isActive?: boolean; runFrequency?: RunFrequency }) => {
    try {
      const response = await http.put(End_Points.Health_OpenGym_Endpoint(), change, { withCredentials: true });
      setConnection(response.data);
    } catch (error: any) {
      setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });
    }
  };

  const syncNow = async () => {
    setBusy(true);
    try {
      const response = await http.post(End_Points.Health_OpenGym_Sync_Endpoint(), {}, { withCredentials: true });
      setConnection(response.data);
      setStatus({ online: true, error: null });
      return true;
    } catch (error: any) {
      setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });
      await fetchConnection();
      return false;
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await http.delete(End_Points.Health_OpenGym_Endpoint(), { withCredentials: true });
      setConnection({ connected: false });
      setStatus(null);
    } catch (error: any) {
      setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return { connection, status, loading, busy, fetchStatus, connect, connectApp, updateSettings, syncNow, disconnect };
};
