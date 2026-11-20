export type Immich_Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type Immich_Consumer = 'connect' | 'status' | 'updates' | 'assistant';

export type Immich_Access = 'public' | 'user' | 'admin' | 'github';

export interface Immich_Api_Call {
  id: string;
  method: Immich_Method;
  path: string;
  access: Immich_Access;
  permission?: string;
  write?: boolean;
  usedBy: Immich_Consumer[];
}

export const IMMICH_ACCESS: Immich_Access[] = ['public', 'user', 'admin', 'github'];

export const IMMICH_USED_CALLS: Immich_Api_Call[] = [
  { id: 'version', method: 'GET', path: '/api/server/version', access: 'public', usedBy: ['connect', 'updates'] },
  { id: 'me', method: 'GET', path: '/api/users/me', access: 'user', permission: 'user.read', usedBy: ['connect', 'status', 'assistant'] },
  { id: 'apiKey', method: 'GET', path: '/api/api-keys/me', access: 'user', permission: 'apiKey.read', usedBy: ['status'] },
  { id: 'myStatistics', method: 'GET', path: '/api/assets/statistics', access: 'user', permission: 'asset.statistics', usedBy: ['status', 'assistant'] },
  { id: 'storage', method: 'GET', path: '/api/server/storage', access: 'user', permission: 'server.storage', usedBy: ['status', 'assistant'] },
  { id: 'statistics', method: 'GET', path: '/api/server/statistics', access: 'admin', permission: 'server.statistics', usedBy: ['assistant'] },
  { id: 'smartSearch', method: 'POST', path: '/api/search/smart', access: 'user', permission: 'asset.read', usedBy: ['assistant'] },
  { id: 'metadataSearch', method: 'POST', path: '/api/search/metadata', access: 'user', permission: 'asset.read', usedBy: ['assistant'] },
  { id: 'albums', method: 'GET', path: '/api/albums', access: 'user', permission: 'album.read', usedBy: ['assistant'] },
  { id: 'album', method: 'GET', path: '/api/albums/{id}', access: 'user', permission: 'album.read', usedBy: ['assistant'] },
  { id: 'albumCreate', method: 'POST', path: '/api/albums', access: 'user', permission: 'album.create', write: true, usedBy: ['assistant'] },
  { id: 'albumUpdate', method: 'PATCH', path: '/api/albums/{id}', access: 'user', permission: 'album.update', write: true, usedBy: ['assistant'] },
  { id: 'albumAdd', method: 'PUT', path: '/api/albums/{id}/assets', access: 'user', permission: 'albumAsset.create', write: true, usedBy: ['assistant'] },
  { id: 'albumRemove', method: 'DELETE', path: '/api/albums/{id}/assets', access: 'user', permission: 'albumAsset.delete', write: true, usedBy: ['assistant'] },
  { id: 'people', method: 'GET', path: '/api/people', access: 'user', permission: 'person.read', usedBy: ['assistant'] },
  { id: 'personUpdate', method: 'PUT', path: '/api/people/{id}', access: 'user', permission: 'person.update', write: true, usedBy: ['assistant'] },
  { id: 'duplicates', method: 'GET', path: '/api/duplicates', access: 'user', permission: 'duplicate.read', usedBy: ['assistant'] },
  { id: 'queues', method: 'GET', path: '/api/queues', access: 'admin', permission: 'queue.read', usedBy: ['status', 'assistant'] },
  { id: 'queueUpdate', method: 'PUT', path: '/api/queues/{name}', access: 'admin', permission: 'queue.update', write: true, usedBy: ['assistant'] },
  { id: 'queueStart', method: 'PUT', path: '/api/jobs/{name}', access: 'admin', permission: 'job.create', write: true, usedBy: ['assistant'] },
  { id: 'jobCreate', method: 'POST', path: '/api/jobs', access: 'admin', permission: 'job.create', write: true, usedBy: ['assistant'] },
  { id: 'config', method: 'GET', path: '/api/system-config', access: 'admin', permission: 'systemConfig.read', usedBy: ['assistant'] },
  { id: 'configUpdate', method: 'PUT', path: '/api/system-config', access: 'admin', permission: 'systemConfig.update', write: true, usedBy: ['assistant'] },
  { id: 'backups', method: 'GET', path: '/api/admin/database-backups', access: 'admin', permission: 'maintenance', usedBy: [] },
  { id: 'backupDownload', method: 'GET', path: '/api/admin/database-backups/{filename}', access: 'admin', permission: 'backup.download', usedBy: [] },
  { id: 'releases', method: 'GET', path: 'api.github.com/repos/immich-app/immich/releases', access: 'github', usedBy: ['updates'] },
];

export const IMMICH_POSSIBLE_CALLS: Immich_Api_Call[] = [
  { id: 'about', method: 'GET', path: '/api/server/about', access: 'user', permission: 'server.about', usedBy: [] },
  { id: 'versionCheck', method: 'GET', path: '/api/server/version-check', access: 'user', permission: 'server.versionCheck', usedBy: [] },
  { id: 'upload', method: 'POST', path: '/api/assets', access: 'user', permission: 'asset.upload', write: true, usedBy: [] },
  { id: 'assetDelete', method: 'DELETE', path: '/api/assets', access: 'user', permission: 'asset.delete', write: true, usedBy: [] },
  { id: 'trashEmpty', method: 'POST', path: '/api/trash/empty', access: 'user', permission: 'asset.delete', write: true, usedBy: [] },
  { id: 'memories', method: 'GET', path: '/api/memories', access: 'user', permission: 'memory.read', usedBy: [] },
  { id: 'sharedLinks', method: 'GET', path: '/api/shared-links', access: 'user', permission: 'sharedLink.read', usedBy: [] },
  { id: 'tags', method: 'GET', path: '/api/tags', access: 'user', permission: 'tag.read', usedBy: [] },
  { id: 'libraries', method: 'GET', path: '/api/libraries', access: 'admin', permission: 'library.read', usedBy: [] },
  { id: 'users', method: 'GET', path: '/api/admin/users', access: 'admin', permission: 'adminUser.read', usedBy: [] },
];

export const accessUse = (access: Immich_Access) => {
  const calls = IMMICH_USED_CALLS.filter((call) => call.access === access);
  if (calls.some((call) => call.write)) return 'write';
  if (calls.length) return 'read';
  return 'none';
};

export const keyAllows = (permissions: string[] | null, permission?: string) =>
  !permission || permissions === null || permissions.includes('all') || permissions.includes(permission);
