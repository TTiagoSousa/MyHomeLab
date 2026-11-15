import { useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";

const errorMessage = (error: any) => error.response?.data?.message || error.message || i18n.t('common:errors.generic');

export const useServerShell = (serverId: string | undefined, onChanged: () => void) => {
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; output: string } | null>(null);
  const { setAlert } = useAlert();

  const enable = async (user: string, port: number) => {
    if (!serverId) return;
    setBusy(true);
    try {
      await http.post(End_Points.Server_Ssh_Endpoint(serverId), { user, port }, { withCredentials: true });
      setTest(null);
      onChanged();
    } catch (error: any) {
      setAlert({ open: true, message: errorMessage(error), type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!serverId) return;
    setBusy(true);
    try {
      await http.delete(End_Points.Server_Ssh_Endpoint(serverId), { withCredentials: true });
      setTest(null);
      onChanged();
    } catch (error: any) {
      setAlert({ open: true, message: errorMessage(error), type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const runTest = async () => {
    if (!serverId) return;
    setBusy(true);
    try {
      const response = await http.get(End_Points.Server_Ssh_Test_Endpoint(serverId), { withCredentials: true });
      setTest(response.data);
    } catch (error: any) {
      setTest({ ok: false, output: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return { busy, test, enable, disable, runTest };
};
