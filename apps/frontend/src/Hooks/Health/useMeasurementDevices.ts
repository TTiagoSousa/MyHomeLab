import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { healthErrorMessage } from "./healthErrors";
import type { DeviceKind, MeasurementDevice } from "./healthTypes";

export interface DeviceDraft {
  name: string;
  kind: DeviceKind;
  brand: string | null;
  model: string | null;
  notes: string | null;
}

export const useMeasurementDevices = () => {
  const [devices, setDevices] = useState<MeasurementDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchDevices = async () => {
    try {
      const response = await http.get(End_Points.Health_Devices_Endpoint(), { withCredentials: true });
      setDevices(response.data);
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
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

  const addDevice = (draft: DeviceDraft) =>
    run(() => http.post(End_Points.Health_Devices_Endpoint(), draft, { withCredentials: true }));

  const updateDevice = (id: string, draft: Partial<DeviceDraft>) =>
    run(() => http.patch(End_Points.Health_Device_Endpoint(id), draft, { withCredentials: true }));

  const makeDefault = (id: string) =>
    run(() => http.patch(End_Points.Health_Device_Endpoint(id), { isDefault: true }, { withCredentials: true }));

  const removeDevice = (id: string) =>
    run(() => http.delete(End_Points.Health_Device_Endpoint(id), { withCredentials: true }));

  const devicesOf = (kind: DeviceKind) => devices.filter((device) => device.kind === kind);

  const defaultOf = (kind: DeviceKind) => devicesOf(kind).find((device) => device.isDefault) ?? null;

  return { devices, loading, saving, devicesOf, defaultOf, addDevice, updateDevice, makeDefault, removeDevice };
};
