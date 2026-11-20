export type Solidtime_Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type Solidtime_Consumer = 'connect' | 'status' | 'assistant';

export type Solidtime_Access = 'public' | 'user' | 'admin';

export interface Solidtime_Api_Call {
  id: string;
  method: Solidtime_Method;
  path: string;
  access: Solidtime_Access;
  write?: boolean;
  usedBy: Solidtime_Consumer[];
}

export const SOLIDTIME_ACCESS: Solidtime_Access[] = ['public', 'user', 'admin'];

const ORG = '/api/v1/organizations/{organization}';

export const SOLIDTIME_USED_CALLS: Solidtime_Api_Call[] = [
  { id: 'up', method: 'GET', path: '/health-check/up', access: 'public', usedBy: ['connect'] },
  { id: 'me', method: 'GET', path: '/api/v1/users/me', access: 'user', usedBy: ['connect', 'status', 'assistant'] },
  { id: 'memberships', method: 'GET', path: '/api/v1/users/me/memberships', access: 'user', usedBy: ['connect', 'status', 'assistant'] },
  { id: 'active', method: 'GET', path: '/api/v1/users/me/time-entries/active', access: 'user', usedBy: ['status', 'assistant'] },
  { id: 'entries', method: 'GET', path: `${ORG}/time-entries`, access: 'user', usedBy: ['assistant'] },
  { id: 'aggregate', method: 'GET', path: `${ORG}/time-entries/aggregate`, access: 'user', usedBy: ['status', 'assistant'] },
  { id: 'entryCreate', method: 'POST', path: `${ORG}/time-entries`, access: 'user', write: true, usedBy: ['assistant'] },
  { id: 'entryUpdate', method: 'PUT', path: `${ORG}/time-entries/{id}`, access: 'user', write: true, usedBy: ['assistant'] },
  { id: 'projects', method: 'GET', path: `${ORG}/projects`, access: 'user', usedBy: ['status', 'assistant'] },
  { id: 'clients', method: 'GET', path: `${ORG}/clients`, access: 'user', usedBy: ['status', 'assistant'] },
  { id: 'tasks', method: 'GET', path: `${ORG}/tasks`, access: 'user', usedBy: ['assistant'] },
  { id: 'tags', method: 'GET', path: `${ORG}/tags`, access: 'user', usedBy: ['assistant'] },
  { id: 'objectSave', method: 'POST', path: `${ORG}/{projects|clients|tasks|tags}`, access: 'admin', write: true, usedBy: ['assistant'] },
  { id: 'objectUpdate', method: 'PUT', path: `${ORG}/{projects|clients|tasks|tags}/{id}`, access: 'admin', write: true, usedBy: ['assistant'] },
  { id: 'export', method: 'POST', path: `${ORG}/export`, access: 'admin', write: true, usedBy: [] },
];

export const SOLIDTIME_POSSIBLE_CALLS: Solidtime_Api_Call[] = [
  { id: 'entryDelete', method: 'DELETE', path: `${ORG}/time-entries/{id}`, access: 'user', write: true, usedBy: [] },
  { id: 'entriesExport', method: 'GET', path: `${ORG}/time-entries/export`, access: 'user', usedBy: [] },
  { id: 'charts', method: 'GET', path: `${ORG}/charts/weekly-history`, access: 'user', usedBy: [] },
  { id: 'reports', method: 'GET', path: `${ORG}/reports`, access: 'user', usedBy: [] },
  { id: 'goals', method: 'GET', path: `${ORG}/goals`, access: 'user', usedBy: [] },
  { id: 'members', method: 'GET', path: `${ORG}/members`, access: 'admin', usedBy: [] },
  { id: 'invitations', method: 'POST', path: `${ORG}/invitations`, access: 'admin', write: true, usedBy: [] },
  { id: 'import', method: 'POST', path: `${ORG}/import`, access: 'admin', write: true, usedBy: [] },
];

export const accessUse = (access: Solidtime_Access) => {
  const calls = SOLIDTIME_USED_CALLS.filter((call) => call.access === access);
  if (calls.some((call) => call.write)) return 'write';
  if (calls.length) return 'read';
  return 'none';
};
