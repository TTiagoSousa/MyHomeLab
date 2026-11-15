export type Google_Tasks_Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type Google_Tasks_Consumer = 'sync';

export interface Google_Tasks_Api_Call {
  id: string;
  method: Google_Tasks_Method;
  path: string;
  scopes: string[];
  usedBy: Google_Tasks_Consumer[];
}

const GOOGLE_SCOPE_PREFIX = 'https://www.googleapis.com/auth/';

const scope = (name: string) => GOOGLE_SCOPE_PREFIX + name;

const READ = [scope('tasks.readonly'), scope('tasks')];
const WRITE = [scope('tasks')];

export const GOOGLE_TASKS_SCOPES = [
  { id: 'readonly', value: scope('tasks.readonly'), includedIn: [scope('tasks')] },
  { id: 'full', value: scope('tasks'), includedIn: [] },
];

export const GOOGLE_TASKS_API_BASE_PATH = 'tasks.googleapis.com/tasks/v1';

export const GOOGLE_TASKS_USED_CALLS: Google_Tasks_Api_Call[] = [
  { id: 'listsList', method: 'GET', path: '/users/@me/lists', scopes: READ, usedBy: ['sync'] },
  { id: 'listCreate', method: 'POST', path: '/users/@me/lists', scopes: WRITE, usedBy: ['sync'] },
  { id: 'tasksList', method: 'GET', path: '/lists/{list}/tasks', scopes: READ, usedBy: ['sync'] },
  { id: 'taskInsert', method: 'POST', path: '/lists/{list}/tasks', scopes: WRITE, usedBy: ['sync'] },
  { id: 'taskPatch', method: 'PATCH', path: '/lists/{list}/tasks/{task}', scopes: WRITE, usedBy: ['sync'] },
  { id: 'taskDelete', method: 'DELETE', path: '/lists/{list}/tasks/{task}', scopes: WRITE, usedBy: ['sync'] },
];

export const GOOGLE_TASKS_POSSIBLE_CALLS: Google_Tasks_Api_Call[] = [
  { id: 'listGet', method: 'GET', path: '/users/@me/lists/{list}', scopes: READ, usedBy: [] },
  { id: 'listPatch', method: 'PATCH', path: '/users/@me/lists/{list}', scopes: WRITE, usedBy: [] },
  { id: 'listDelete', method: 'DELETE', path: '/users/@me/lists/{list}', scopes: WRITE, usedBy: [] },
  { id: 'taskGet', method: 'GET', path: '/lists/{list}/tasks/{task}', scopes: READ, usedBy: [] },
  { id: 'taskUpdate', method: 'PUT', path: '/lists/{list}/tasks/{task}', scopes: WRITE, usedBy: [] },
  { id: 'taskMove', method: 'POST', path: '/lists/{list}/tasks/{task}/move', scopes: WRITE, usedBy: [] },
  { id: 'tasksClear', method: 'POST', path: '/lists/{list}/clear', scopes: WRITE, usedBy: [] },
];

export const shortScope = (value: string) => value.replace(GOOGLE_SCOPE_PREFIX, '');
