import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { todoErrorMessage } from "./todoErrorMessage";

export const TODO_SYNC_INTERVALS = [5, 15, 30, 60, 360, 720, 1440];

export type TodoSyncScope = 'ALL' | 'LISTS';

export interface TodoSyncLink {
  id: string;
  listId: string;
  accountId: string;
  remoteListName: string;
  lastSyncAt: string | null;
  lastError: string | null;
  tasks: number;
}

export interface TodoSyncAccount {
  id: string;
  provider: 'GOOGLE_TASKS' | 'NEXTCLOUD';
  emailAddress: string | null;
  label: string;
  isActive: boolean;
}

export interface TodoSyncOverview {
  enabled: boolean;
  intervalMinutes: number;
  lastRunAt: string | null;
  running: boolean;
  lists: { id: string; name: string; color: string | null }[];
  accounts: TodoSyncAccount[];
  groups: TodoSyncGroup[];
}

export interface TodoSyncGroup {
  id: string;
  name: string;
  scope: TodoSyncScope;
  includeLocal: boolean;
  listNames: string[];
  accountIds: string[];
  lastError: string | null;
  links: TodoSyncLink[];
}

export interface RemoteTaskList {
  id: string;
  title: string;
}

export interface TodoSyncGroupPayload {
  name: string;
  scope: TodoSyncScope;
  includeLocal: boolean;
  listNames: string[];
  accountIds: string[];
}

export const useTodoSync = () => {
  const [overview, setOverview] = useState<TodoSyncOverview | null>(null);
  const [remoteLists, setRemoteLists] = useState<Record<string, RemoteTaskList[]>>({});
  const [busy, setBusy] = useState(false);
  const { setAlert } = useAlert();

  const fail = (error: any) => setAlert({ open: true, message: todoErrorMessage(error), type: 'error' });

  const fetchRemoteLists = async (accountId: string) => {
    try {
      const response = await http.get(End_Points.Todo_Sync_Remote_Lists_Endpoint(accountId), { withCredentials: true });
      setRemoteLists((current) => ({ ...current, [accountId]: response.data }));
    } catch (error: any) {
      setRemoteLists((current) => ({ ...current, [accountId]: [] }));
      fail(error);
    }
  };

  const fetchOverview = async () => {
    try {
      const response = await http.get(End_Points.Todo_Sync_Endpoint(), { withCredentials: true });
      setOverview(response.data);
    } catch (error: any) {
      fail(error);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const send = async (request: () => Promise<{ data: TodoSyncOverview }>, success?: string) => {
    setBusy(true);
    try {
      const response = await request();
      setOverview(response.data);
      if (success) setAlert({ open: true, message: success, type: 'success' });
      return true;
    } catch (error: any) {
      fail(error);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveSetting = (setting: { enabled?: boolean; intervalMinutes?: number }) =>
    send(() => http.put(End_Points.Todo_Sync_Setting_Endpoint(), setting, { withCredentials: true }));

  const runNow = () =>
    send(() => http.post(End_Points.Todo_Sync_Run_Endpoint(), {}, { withCredentials: true }), i18n.t('todos:sync.alerts.synced'));

  const saveGroup = (group: TodoSyncGroupPayload, id?: string) =>
    send(
      () =>
        id
          ? http.put(End_Points.Todo_Sync_Group_Endpoint(id), group, { withCredentials: true })
          : http.post(End_Points.Todo_Sync_Groups_Endpoint(), group, { withCredentials: true }),
      i18n.t('todos:sync.alerts.saved'),
    );

  const removeGroup = (id: string) =>
    send(() => http.delete(End_Points.Todo_Sync_Group_Endpoint(id), { withCredentials: true }), i18n.t('todos:sync.alerts.unlinked'));

  return { overview, remoteLists, busy, fetchOverview, fetchRemoteLists, saveSetting, runNow, saveGroup, removeGroup };
};
