export type Trek_Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type Trek_Consumer = 'connect' | 'status' | 'updates' | 'assistant';

export interface Trek_Api_Call {
  id: string;
  method: Trek_Method;
  path: string;
  auth: 'public' | 'admin' | 'mcp';
  usedBy: Trek_Consumer[];
}

export const TREK_REST_CALLS: Trek_Api_Call[] = [
  { id: 'appConfig', method: 'GET', path: '/api/auth/app-config', auth: 'public', usedBy: ['connect', 'status', 'updates'] },
  { id: 'login', method: 'POST', path: '/api/auth/login', auth: 'admin', usedBy: ['connect', 'status'] },
  { id: 'autoSettings', method: 'GET', path: '/api/backup/auto-settings', auth: 'admin', usedBy: ['connect'] },
  { id: 'backupList', method: 'GET', path: '/api/backup/list', auth: 'admin', usedBy: ['status'] },
  { id: 'backupCreate', method: 'POST', path: '/api/backup/create', auth: 'admin', usedBy: [] },
  { id: 'backupDownload', method: 'GET', path: '/api/backup/download/{file}', auth: 'admin', usedBy: [] },
  { id: 'backupDelete', method: 'DELETE', path: '/api/backup/{file}', auth: 'admin', usedBy: [] },
  { id: 'oauthToken', method: 'POST', path: '/oauth/token (client_credentials)', auth: 'mcp', usedBy: ['status', 'assistant'] },
  { id: 'mcp', method: 'POST', path: '/mcp (initialize · tools/list · tools/call)', auth: 'mcp', usedBy: ['status', 'assistant'] },
];

export const TREK_SCOPE_GROUPS: { group: string; scopes: string[] }[] = [
  { group: 'trips', scopes: ['trips:read', 'trips:write', 'trips:delete', 'trips:share'] },
  { group: 'places', scopes: ['places:read', 'places:write'] },
  { group: 'collections', scopes: ['collections:read', 'collections:write'] },
  { group: 'atlas', scopes: ['atlas:read', 'atlas:write'] },
  { group: 'packing', scopes: ['packing:read', 'packing:write'] },
  { group: 'todos', scopes: ['todos:read', 'todos:write'] },
  { group: 'budget', scopes: ['budget:read', 'budget:write'] },
  { group: 'reservations', scopes: ['reservations:read', 'reservations:write'] },
  { group: 'collab', scopes: ['collab:read', 'collab:write'] },
  { group: 'notifications', scopes: ['notifications:read', 'notifications:write'] },
  { group: 'vacay', scopes: ['vacay:read', 'vacay:write'] },
  { group: 'geo', scopes: ['geo:read'] },
  { group: 'weather', scopes: ['weather:read'] },
  { group: 'journey', scopes: ['journey:read', 'journey:write', 'journey:share'] },
  { group: 'files', scopes: ['files:read', 'files:write', 'files:content'] },
  { group: 'settings', scopes: ['settings:read', 'settings:write'] },
  { group: 'plugins', scopes: ['plugins:use'] },
];
