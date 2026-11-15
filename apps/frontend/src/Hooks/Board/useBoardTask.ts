import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { boardErrorMessage } from "./useBoardProjects";
import type { TaskDetail, TaskPayload } from "./boardTypes";

const REFRESH_MS = 8000;

export const useBoardTask = (taskId: string | undefined) => {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { setAlert } = useAlert();

  const fetchTask = async () => {
    if (!taskId) return;
    try {
      const response = await http.get(End_Points.Board_Task_Endpoint(taskId), { withCredentials: true });
      setTask(response.data);
      setError('');
    } catch (error: any) {
      setError(boardErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchTask();
  }, [taskId]);

  useEffect(() => {
    const running = task?.schedules.some((schedule) => schedule.runs[0]?.status === 'RUNNING' || (schedule.enabled && schedule.nextRunAt && new Date(schedule.nextRunAt) <= new Date()));
    if (!running) return;
    const timer = setTimeout(fetchTask, REFRESH_MS);
    return () => clearTimeout(timer);
  }, [task]);

  const run = async (work: () => Promise<unknown>, success?: string): Promise<boolean> => {
    setSaving(true);
    try {
      await work();
      await fetchTask();
      if (success) setAlert({ open: true, message: i18n.t(success), type: 'success' });
      return true;
    } catch (error: any) {
      setAlert({ open: true, message: boardErrorMessage(error), type: 'error' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveTask = (payload: TaskPayload) =>
    run(() => http.patch(End_Points.Board_Task_Endpoint(taskId!), payload, { withCredentials: true }));

  const deleteTask = () =>
    run(() => http.delete(End_Points.Board_Task_Endpoint(taskId!), { withCredentials: true }), 'tasks:alerts.taskDeleted');

  const addComment = (body: string) =>
    run(() => http.post(End_Points.Board_Task_Comments_Endpoint(taskId!), { body }, { withCredentials: true }));

  const addLink = (url: string, title: string) =>
    run(() => http.post(End_Points.Board_Task_Links_Endpoint(taskId!), { url, title: title || undefined }, { withCredentials: true }));

  const removeLink = (linkId: string) =>
    run(() => http.delete(End_Points.Board_Task_Link_Endpoint(taskId!, linkId), { withCredentials: true }));

  const linkDoc = (docId: string) =>
    run(() => http.post(End_Points.Board_Task_Docs_Endpoint(taskId!), { docId }, { withCredentials: true }));

  const unlinkDoc = (docId: string) =>
    run(() => http.delete(End_Points.Board_Task_Doc_Endpoint(taskId!, docId), { withCredentials: true }));

  const addRelation = (task: string, kind: string) =>
    run(() => http.post(End_Points.Board_Task_Relations_Endpoint(taskId!), { task, kind }, { withCredentials: true }));

  const removeRelation = (relationId: string) =>
    run(() => http.delete(End_Points.Board_Relation_Endpoint(relationId), { withCredentials: true }));

  const addAttachment = (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return run(() => http.post(End_Points.Board_Task_Attachments_Endpoint(taskId!), form, { withCredentials: true }));
  };

  const removeAttachment = (attachmentId: string) =>
    run(() => http.delete(End_Points.Board_Attachment_Endpoint(attachmentId), { withCredentials: true }));

  return {
    task,
    loading,
    saving,
    error,
    fetchTask,
    saveTask,
    deleteTask,
    addComment,
    addLink,
    removeLink,
    linkDoc,
    unlinkDoc,
    addRelation,
    removeRelation,
    addAttachment,
    removeAttachment,
  };
};
