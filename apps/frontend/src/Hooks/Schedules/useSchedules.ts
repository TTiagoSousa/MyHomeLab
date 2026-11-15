import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import type { DocLinkType } from "../Docs/docTypes";
import type { Schedule, ScheduleAgent, SchedulePayload } from "./scheduleTypes";

const errorMessage = (error: any) =>
  error.response?.data?.message || error.message || i18n.t('common:errors.generic');

export const useSchedules = (link?: { linkType: DocLinkType; targetId: string }) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [agents, setAgents] = useState<ScheduleAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { setAlert } = useAlert();

  const fetchSchedules = async () => {
    try {
      const response = await http.get(End_Points.Schedules_Endpoint(), {
        params: link ? { linkType: link.linkType, targetId: link.targetId } : undefined,
        withCredentials: true,
      });
      setSchedules(response.data);
      setError('');
    } catch (error: any) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const response = await http.get(End_Points.Agent_Endpoint(), { withCredentials: true });
      setAgents(response.data.map((agent: ScheduleAgent) => ({ key: agent.key, name: agent.name, isActive: agent.isActive })));
    } catch {
      setAgents([]);
    }
  };

  useEffect(() => {
    fetchSchedules();
    fetchAgents();
  }, [link?.linkType, link?.targetId]);

  const saveSchedule = async (payload: SchedulePayload, id?: string): Promise<string | null> => {
    setSaving(true);
    try {
      if (id) await http.put(End_Points.Schedule_By_Id_Endpoint(id), payload, { withCredentials: true });
      else await http.post(End_Points.Schedules_Endpoint(), payload, { withCredentials: true });
      await fetchSchedules();
      setAlert({ open: true, message: i18n.t(id ? 'schedules:alerts.saved' : 'schedules:alerts.created'), type: 'success' });
      return null;
    } catch (error: any) {
      return errorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const runSchedule = async (id: string) => {
    try {
      await http.post(End_Points.Schedule_Run_Endpoint(id), {}, { withCredentials: true });
      await fetchSchedules();
      setAlert({ open: true, message: i18n.t('schedules:alerts.running'), type: 'success' });
    } catch (error: any) {
      setAlert({ open: true, message: errorMessage(error), type: 'error' });
    }
  };

  return { schedules, agents, loading, saving, error, fetchSchedules, saveSchedule, runSchedule };
};
