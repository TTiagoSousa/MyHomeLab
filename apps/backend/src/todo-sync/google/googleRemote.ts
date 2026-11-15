import { TaskRemote } from '../remote/taskRemote';
import {
  createTaskList,
  deleteTask,
  insertTask,
  listTaskLists,
  listTasks,
  patchTask,
} from './google-tasks.client';

/** As tarefas de um email do Google Tasks, com um token já válido. */
export const googleRemote = (accessToken: string): TaskRemote => ({
  listLists: () => listTaskLists(accessToken),
  createList: (title) => createTaskList(accessToken, title),
  listTasks: (listId) => listTasks(accessToken, listId),
  insertTask: (listId, task, parentId) =>
    insertTask(accessToken, listId, task, parentId),
  patchTask: (listId, taskId, task) =>
    patchTask(accessToken, listId, taskId, task),
  deleteTask: (listId, taskId) => deleteTask(accessToken, listId, taskId),
});
