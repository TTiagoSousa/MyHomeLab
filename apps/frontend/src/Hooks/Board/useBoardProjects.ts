import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import type { BoardProject, ProjectPayload, StateGroup } from "./boardTypes";

export const boardErrorMessage = (error: any) => {
  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  return message || error.message || i18n.t('common:errors.generic');
};

export const useBoardProjects = () => {
  const [projects, setProjects] = useState<BoardProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { setAlert } = useAlert();

  const fetchProjects = async () => {
    try {
      const response = await http.get(End_Points.Board_Projects_Endpoint(), { withCredentials: true });
      setProjects(response.data);
      setError('');
    } catch (error: any) {
      setError(boardErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const run = async (work: () => Promise<unknown>, success?: string): Promise<string | null> => {
    setSaving(true);
    try {
      await work();
      await fetchProjects();
      if (success) setAlert({ open: true, message: i18n.t(success), type: 'success' });
      return null;
    } catch (error: any) {
      return boardErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const saveProject = async (payload: ProjectPayload, id?: string): Promise<{ failure: string | null; projectId: string | null }> => {
    let projectId: string | null = id ?? null;
    const failure = await run(async () => {
      const response = id
        ? await http.patch(End_Points.Board_Project_Endpoint(id), payload, { withCredentials: true })
        : await http.post(End_Points.Board_Projects_Endpoint(), payload, { withCredentials: true });
      projectId = response.data.id;
    }, id ? 'tasks:alerts.projectSaved' : 'tasks:alerts.projectCreated');
    return { failure, projectId };
  };

  const deleteProject = (id: string) =>
    run(() => http.delete(End_Points.Board_Project_Endpoint(id), { withCredentials: true }), 'tasks:alerts.projectDeleted');

  const addState = (projectId: string, name: string, group: StateGroup) =>
    run(() => http.post(End_Points.Board_Project_States_Endpoint(projectId), { name, group }, { withCredentials: true }));

  const saveState = (stateId: string, payload: { name?: string; group?: StateGroup; color?: string; position?: number; phase?: string }) =>
    run(() => http.patch(End_Points.Board_State_Endpoint(stateId), payload, { withCredentials: true }));

  const deleteState = (stateId: string) =>
    run(() => http.delete(End_Points.Board_State_Endpoint(stateId), { withCredentials: true }));

  const addModule = (projectId: string, name: string) =>
    run(() => http.post(End_Points.Board_Project_Modules_Endpoint(projectId), { name }, { withCredentials: true }));

  const saveModule = (moduleId: string, payload: { name?: string; description?: string }) =>
    run(() => http.patch(End_Points.Board_Module_Endpoint(moduleId), payload, { withCredentials: true }));

  const deleteModule = (moduleId: string) =>
    run(() => http.delete(End_Points.Board_Module_Endpoint(moduleId), { withCredentials: true }));

  const addCycle = (projectId: string, name: string, startDate: string, endDate: string) =>
    run(() => http.post(End_Points.Board_Project_Cycles_Endpoint(projectId), { name, startDate, endDate }, { withCredentials: true }));

  const deleteCycle = (cycleId: string) =>
    run(() => http.delete(End_Points.Board_Cycle_Endpoint(cycleId), { withCredentials: true }));

  return {
    addCycle,
    deleteCycle,
    projects,
    loading,
    saving,
    error,
    fetchProjects,
    saveProject,
    deleteProject,
    addState,
    saveState,
    deleteState,
    addModule,
    saveModule,
    deleteModule,
  };
};
