export type Stirling_Method = 'GET' | 'POST' | 'PUT';

export type Stirling_Consumer = 'connect' | 'status' | 'updates' | 'backups' | 'assistant';

export type Stirling_Access = 'user' | 'admin' | 'github';

export interface Stirling_Api_Call {
  id: string;
  method: Stirling_Method;
  path: string;
  access: Stirling_Access;
  write?: boolean;
  usedBy: Stirling_Consumer[];
}

export const STIRLING_ACCESS: Stirling_Access[] = ['user', 'admin', 'github'];

export const STIRLING_USED_CALLS: Stirling_Api_Call[] = [
  { id: 'status', method: 'GET', path: '/api/v1/info/status', access: 'user', usedBy: ['connect', 'status', 'updates', 'assistant'] },
  { id: 'apiDocs', method: 'GET', path: '/v1/api-docs', access: 'user', usedBy: ['connect', 'status', 'assistant'] },
  { id: 'endpoints', method: 'GET', path: '/api/v1/settings/get-endpoints-status', access: 'user', usedBy: ['status', 'assistant', 'backups'] },
  { id: 'operation', method: 'POST', path: '/api/v1/{operação}', access: 'user', write: true, usedBy: ['assistant'] },
  { id: 'settings', method: 'GET', path: '/api/v1/admin/settings', access: 'admin', usedBy: ['connect', 'status', 'assistant', 'backups'] },
  { id: 'settingsDelta', method: 'GET', path: '/api/v1/admin/settings/delta', access: 'admin', usedBy: ['assistant'] },
  { id: 'settingsUpdate', method: 'PUT', path: '/api/v1/admin/settings', access: 'admin', write: true, usedBy: ['assistant'] },
  { id: 'mcp', method: 'POST', path: '/mcp', access: 'user', usedBy: ['status', 'assistant'] },
  { id: 'releases', method: 'GET', path: 'api.github.com/repos/Stirling-Tools/Stirling-PDF/releases', access: 'github', usedBy: ['updates'] },
];

export const STIRLING_POSSIBLE_CALLS: Stirling_Api_Call[] = [
  { id: 'pipeline', method: 'POST', path: '/api/v1/pipeline/handleData', access: 'user', write: true, usedBy: [] },
  { id: 'restart', method: 'POST', path: '/api/v1/admin/settings/restart', access: 'admin', write: true, usedBy: [] },
  { id: 'users', method: 'GET', path: '/api/v1/user/admin/users', access: 'admin', usedBy: [] },
  { id: 'audit', method: 'GET', path: '/api/v1/audit/data', access: 'admin', usedBy: [] },
];

export const accessUse = (access: Stirling_Access) => {
  const calls = STIRLING_USED_CALLS.filter((call) => call.access === access);
  if (calls.some((call) => call.write)) return 'write';
  if (calls.length) return 'read';
  return 'none';
};
