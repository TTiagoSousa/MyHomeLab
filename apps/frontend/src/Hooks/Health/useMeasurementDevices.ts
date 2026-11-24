import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { healthErrorMessage } from "./healthErrors";
import type { MeasurementDevice } from "./healthTypes";

export const useMeasurementDevices = () => {
  const [devices, setDevices] = useState<MeasurementDevice[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchDevices = async () => {
    try {
      const response = await http.get(End_Points.Health_Devices_Endpoint(), { withCredentials: true });
      setDevices(response.data);
    } catch {
      setDevices([]);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const run = async (request: () => Promise<{ data: MeasurementDevice[] }>): Promise<string | null> => {
    setSaving(true);
    try {
      const response = await request();
      setDevices(response.data);
      return null;
    } catch (error: any) {
      return healthErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const addDevice = (name: string) =>
    run(() => http.post(End_Points.Health_Devices_Endpoint(), { name }, { withCredentials: true }));

  const makeDefault = (id: string) =>
    run(() => http.patch(End_Points.Health_Device_Endpoint(id), { isDefault: true }, { withCredentials: true }));

  const removeDevice = (id: string) =>
    run(() => http.delete(End_Points.Health_Device_Endpoint(id), { withCredentials: true }));

  const defaultDevice = devices.find((device) => device.isDefault) ?? null;

  return { devices, defaultDevice, saving, addDevice, makeDefault, removeDevice };
};
