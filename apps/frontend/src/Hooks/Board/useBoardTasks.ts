import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { boardErrorMessage } from "./useBoardProjects";
import type { BoardTask, TaskFilters, TaskPayload } from "./boardTypes";

export const useBoardTasks = (projectId: string | undefined, filters: TaskFilters) => {
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { setAlert } = useAlert();

  const fetchTasks = async () => {
    if (!projectId) return;
    try {
      const response = await http.get(End_Points.Board_Tasks_Endpoint(), {
        params: {
          projectId,
          search: filters.search || undefined,
          stateId: filters.stateId || undefined,
          priority: filters.priority || undefined,
          assignee: filters.assignee || undefined,
          label: filters.label || undefined,
          moduleId: filters.moduleId || undefined,
          cycleId: filters.cycleId || undefined,
        },
        withCredentials: true,
      });
      setTasks(response.data);
      setError('');
    } catch (error: any) {
      setError(boardErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchTasks();
  }, [projectId, filters.search, filters.stateId, filters.priority, filters.assignee, filters.label, filters.moduleId, filters.cycleId]);

  const createTask = async (payload: TaskPayload): Promise<BoardTask | string> => {
    try {
      const response = await http.post(End_Points.Board_Tasks_Endpoint(), payload, { withCredentials: true });
      await fetchTasks();
      setAlert({ open: true, message: i18n.t('tasks:alerts.taskCreated', { key: response.data.key }), type: 'success' });
      return response.data;
    } catch (error: any) {
      return boardErrorMessage(error);
    }
  };

  const moveTask = async (task: BoardTask, stateId: string, position: number) => {
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, stateId, position } : item)));
    try {
      await http.patch(End_Points.Board_Task_Endpoint(task.id), { stateId, position }, { withCredentials: true });
      await fetchTasks();
    } catch (error: any) {
      setAlert({ open: true, message: boardErrorMessage(error), type: 'error' });
      await fetchTasks();
    }
  };

  const bulkUpdate = async (ids: string[], payload: TaskPayload): Promise<boolean> => {
    try {
      const response = await http.patch(End_Points.Board_Tasks_Bulk_Endpoint(), { ids, ...payload }, { withCredentials: true });
      await fetchTasks();
      setAlert({ open: true, message: i18n.t('tasks:alerts.bulkDone', { count: response.data.changed }), type: response.data.failed.length ? 'warning' : 'success' });
      return true;
    } catch (error: any) {
      setAlert({ open: true, message: boardErrorMessage(error), type: 'error' });
      return false;
    }
  };

  return { tasks, loading, error, fetchTasks, createTask, moveTask, bulkUpdate };
};
