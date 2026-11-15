export type Home_Assistant_Method = 'GET' | 'POST' | 'DELETE' | 'WS';

export type Home_Assistant_Consumer = 'status' | 'updates' | 'backups' | 'assistant';

export type Home_Assistant_Access = 'user' | 'admin' | 'supervisor';

export interface Home_Assistant_Api_Call {
  id: string;
  method: Home_Assistant_Method;
  path: string;
  access: Home_Assistant_Access;
  write?: boolean;
  usedBy: Home_Assistant_Consumer[];
}

export const HOME_ASSISTANT_ACCESS: Home_Assistant_Access[] = ['user', 'admin', 'supervisor'];

const CONFIG = '/api/config/{automation|script|scene}/config/{id}';

export const HOME_ASSISTANT_USED_CALLS: Home_Assistant_Api_Call[] = [
  { id: 'config', method: 'GET', path: '/api/config', access: 'user', usedBy: ['status', 'updates', 'assistant'] },
  { id: 'states', method: 'GET', path: '/api/states', access: 'user', usedBy: ['status', 'updates', 'assistant'] },
  { id: 'state', method: 'GET', path: '/api/states/{entity_id}', access: 'user', usedBy: ['assistant'] },
  { id: 'services', method: 'GET', path: '/api/services', access: 'user', usedBy: ['assistant'] },
  { id: 'callService', method: 'POST', path: '/api/services/{domain}/{service}', access: 'user', write: true, usedBy: ['updates', 'assistant'] },
  { id: 'configGet', method: 'GET', path: CONFIG, access: 'admin', usedBy: ['assistant'] },
  { id: 'configSave', method: 'POST', path: CONFIG, access: 'admin', write: true, usedBy: ['assistant'] },
  { id: 'configDelete', method: 'DELETE', path: CONFIG, access: 'admin', write: true, usedBy: ['assistant'] },
  { id: 'backupDownload', method: 'GET', path: '/api/backup/download/{backup_id}', access: 'admin', usedBy: ['backups'] },
  { id: 'currentUser', method: 'WS', path: 'auth/current_user', access: 'user', usedBy: ['status'] },
  { id: 'registries', method: 'WS', path: 'config/{entity|device|area}_registry/list', access: 'user', usedBy: ['status', 'updates', 'assistant'] },
  { id: 'entityUpdate', method: 'WS', path: 'config/entity_registry/update', access: 'admin', write: true, usedBy: ['assistant'] },
  { id: 'systemLog', method: 'WS', path: 'system_log/list', access: 'admin', usedBy: ['assistant'] },
  { id: 'addonInfo', method: 'WS', path: 'supervisor/api · /addons/{slug}/info', access: 'supervisor', usedBy: ['updates'] },
  { id: 'backupInfo', method: 'WS', path: 'backup/info', access: 'admin', usedBy: ['backups'] },
  { id: 'backupAgents', method: 'WS', path: 'backup/agents/info', access: 'admin', usedBy: ['backups'] },
  { id: 'backupGenerate', method: 'WS', path: 'backup/generate', access: 'admin', write: true, usedBy: ['backups'] },
  { id: 'backupDelete', method: 'WS', path: 'backup/delete', access: 'admin', write: true, usedBy: ['backups'] },
];

export const HOME_ASSISTANT_POSSIBLE_CALLS: Home_Assistant_Api_Call[] = [
  { id: 'history', method: 'GET', path: '/api/history/period/{timestamp}', access: 'user', usedBy: [] },
  { id: 'logbook', method: 'GET', path: '/api/logbook/{timestamp}', access: 'user', usedBy: [] },
  { id: 'statistics', method: 'WS', path: 'recorder/statistics_during_period', access: 'user', usedBy: [] },
  { id: 'calendars', method: 'GET', path: '/api/calendars/{entity_id}', access: 'user', usedBy: [] },
  { id: 'camera', method: 'GET', path: '/api/camera_proxy/{entity_id}', access: 'user', usedBy: [] },
  { id: 'template', method: 'POST', path: '/api/template', access: 'user', usedBy: [] },
  { id: 'dashboards', method: 'WS', path: 'lovelace/config', access: 'user', usedBy: [] },
  { id: 'subscribeEvents', method: 'WS', path: 'subscribe_events', access: 'user', usedBy: [] },
  { id: 'errorLog', method: 'GET', path: '/api/error_log', access: 'admin', usedBy: [] },
  { id: 'checkConfig', method: 'POST', path: '/api/config/core/check_config', access: 'admin', usedBy: [] },
  { id: 'fireEvent', method: 'POST', path: '/api/events/{event_type}', access: 'admin', write: true, usedBy: [] },
  { id: 'deviceUpdate', method: 'WS', path: 'config/device_registry/update', access: 'admin', write: true, usedBy: [] },
  { id: 'backupRestore', method: 'WS', path: 'backup/restore', access: 'admin', write: true, usedBy: [] },
  { id: 'addonsList', method: 'WS', path: 'supervisor/api · /addons', access: 'supervisor', usedBy: [] },
  { id: 'addonLogs', method: 'WS', path: 'supervisor/api · /addons/{slug}/logs', access: 'supervisor', usedBy: [] },
  { id: 'hostInfo', method: 'WS', path: 'supervisor/api · /host/info', access: 'supervisor', usedBy: [] },
];

export const accessUse = (access: Home_Assistant_Access) => {
  const calls = HOME_ASSISTANT_USED_CALLS.filter((call) => call.access === access);
  if (calls.some((call) => call.write)) return 'write';
  if (calls.length) return 'read';
  return 'none';
};
