export type OpenGym_Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type OpenGym_Consumer = 'connect' | 'status' | 'updates' | 'backups' | 'assistant';

export type OpenGym_Access = 'public' | 'profile' | 'admin' | 'github';

export interface OpenGym_Api_Call {
  id: string;
  method: OpenGym_Method;
  path: string;
  access: OpenGym_Access;
  write?: boolean;
  usedBy: OpenGym_Consumer[];
}

export const OPENGYM_ACCESS: OpenGym_Access[] = ['public', 'profile', 'admin', 'github'];

export const OPENGYM_USED_CALLS: OpenGym_Api_Call[] = [
  { id: 'health', method: 'GET', path: '/api/health', access: 'public', usedBy: ['connect', 'status', 'updates'] },
  { id: 'page', method: 'GET', path: '/ · /assets/index-*.js', access: 'public', usedBy: ['status', 'updates'] },
  { id: 'pairRedeem', method: 'POST', path: '/api/pair/redeem', access: 'public', usedBy: ['connect'] },
  { id: 'me', method: 'GET', path: '/api/me', access: 'profile', usedBy: ['status', 'assistant'] },
  { id: 'dataGet', method: 'GET', path: '/api/data', access: 'profile', usedBy: ['status', 'backups', 'assistant'] },
  { id: 'dataPut', method: 'PUT', path: '/api/data', access: 'profile', write: true, usedBy: ['assistant'] },
  { id: 'catalog', method: 'GET', path: 'raw.githubusercontent.com/…/v{versão}/frontend/src/lib/exercises-data.js', access: 'github', usedBy: ['assistant'] },
  { id: 'catalogPt', method: 'GET', path: 'raw.githubusercontent.com/…/catalogue/i18n/pt.json', access: 'github', usedBy: ['assistant'] },
  { id: 'releases', method: 'GET', path: 'api.github.com/repos/DuarteSantos8/openGym/releases', access: 'github', usedBy: ['updates'] },
];

export const OPENGYM_POSSIBLE_CALLS: OpenGym_Api_Call[] = [
  { id: 'config', method: 'GET', path: '/api/config', access: 'public', usedBy: [] },
  { id: 'dataRev', method: 'GET', path: '/api/data/rev', access: 'profile', usedBy: [] },
  { id: 'nudgeCheck', method: 'GET', path: '/api/nudge-check', access: 'profile', usedBy: [] },
  { id: 'mediaGet', method: 'GET', path: '/api/media/{hash}', access: 'profile', usedBy: [] },
  { id: 'mediaPut', method: 'PUT', path: '/api/media/{hash}', access: 'profile', write: true, usedBy: [] },
  { id: 'integrations', method: 'GET', path: '/api/integrations', access: 'profile', usedBy: [] },
  { id: 'webhookConnect', method: 'POST', path: '/api/integrations/connect', access: 'profile', write: true, usedBy: [] },
  { id: 'watchLinks', method: 'GET', path: '/api/watch/links', access: 'profile', usedBy: [] },
  { id: 'pushTest', method: 'POST', path: '/api/push/test', access: 'profile', write: true, usedBy: [] },
  { id: 'coachStatus', method: 'GET', path: '/api/coach/status', access: 'profile', usedBy: [] },
  { id: 'logoutAll', method: 'POST', path: '/api/logout/all', access: 'profile', write: true, usedBy: [] },
  { id: 'adminUsers', method: 'GET', path: '/api/admin/users', access: 'admin', usedBy: [] },
  { id: 'adminAudit', method: 'GET', path: '/api/admin/audit', access: 'admin', usedBy: [] },
  { id: 'adminInvite', method: 'POST', path: '/api/admin/invites/new', access: 'admin', write: true, usedBy: [] },
];

export const accessUse = (access: OpenGym_Access) => {
  const calls = OPENGYM_USED_CALLS.filter((call) => call.access === access);
  if (calls.some((call) => call.write)) return 'write';
  if (calls.length) return 'read';
  return 'none';
};
