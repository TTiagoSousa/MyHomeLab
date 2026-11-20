export type GameTracker_Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type GameTracker_Consumer = 'connect' | 'status' | 'updates' | 'assistant';

export type GameTracker_Access = 'public' | 'user' | 'admin' | 'github';

export interface GameTracker_Api_Call {
  id: string;
  method: GameTracker_Method;
  path: string;
  access: GameTracker_Access;
  write?: boolean;
  usedBy: GameTracker_Consumer[];
}

export const GAMETRACKER_ACCESS: GameTracker_Access[] = ['public', 'user', 'admin', 'github'];

export const GAMETRACKER_USED_CALLS: GameTracker_Api_Call[] = [
  { id: 'health', method: 'GET', path: '/api/health', access: 'public', usedBy: ['connect', 'status', 'updates'] },
  { id: 'me', method: 'GET', path: '/api/auth/me', access: 'user', usedBy: ['connect', 'status', 'assistant'] },
  { id: 'library', method: 'GET', path: '/api/library', access: 'user', usedBy: ['status', 'assistant'] },
  { id: 'stats', method: 'GET', path: '/api/library/stats', access: 'user', usedBy: ['status', 'assistant'] },
  { id: 'entry', method: 'GET', path: '/api/library/{gameId}', access: 'user', usedBy: ['assistant'] },
  { id: 'entryPut', method: 'PUT', path: '/api/library/{gameId}', access: 'user', write: true, usedBy: ['assistant'] },
  { id: 'entryDelete', method: 'DELETE', path: '/api/library/{gameId}', access: 'user', write: true, usedBy: ['assistant'] },
  { id: 'search', method: 'GET', path: '/api/games/search', access: 'user', usedBy: ['assistant'] },
  { id: 'game', method: 'GET', path: '/api/games/{id}', access: 'user', usedBy: ['assistant'] },
  { id: 'price', method: 'GET', path: '/api/prices/games/{gameId}', access: 'user', usedBy: ['assistant'] },
  { id: 'watchlist', method: 'GET', path: '/api/prices/watchlist', access: 'user', usedBy: ['assistant'] },
  { id: 'watchPut', method: 'PUT', path: '/api/prices/watchlist/{gameId}', access: 'user', write: true, usedBy: ['assistant'] },
  { id: 'watchDelete', method: 'DELETE', path: '/api/prices/watchlist/{gameId}', access: 'user', write: true, usedBy: ['assistant'] },
  { id: 'backupCreate', method: 'POST', path: '/api/backups', access: 'admin', write: true, usedBy: [] },
  { id: 'backupDownload', method: 'GET', path: '/api/backups/{name}/download', access: 'admin', usedBy: [] },
  { id: 'releases', method: 'GET', path: 'api.github.com/repos/TTiagoSousa/GamesTracker-Vault/releases', access: 'github', usedBy: ['updates'] },
];

export const GAMETRACKER_POSSIBLE_CALLS: GameTracker_Api_Call[] = [
  { id: 'discover', method: 'GET', path: '/api/library/discover', access: 'user', usedBy: [] },
  { id: 'filters', method: 'GET', path: '/api/games/filters', access: 'user', usedBy: [] },
  { id: 'backlogPrices', method: 'GET', path: '/api/prices/backlog', access: 'user', usedBy: [] },
  { id: 'featured', method: 'GET', path: '/api/prices/featured', access: 'user', usedBy: [] },
  { id: 'notifications', method: 'GET', path: '/api/notifications', access: 'user', usedBy: [] },
  { id: 'aiChat', method: 'POST', path: '/api/ai/chat', access: 'user', write: true, usedBy: [] },
  { id: 'backups', method: 'GET', path: '/api/backups', access: 'admin', usedBy: [] },
  { id: 'systemVersion', method: 'GET', path: '/api/system/version', access: 'admin', usedBy: [] },
  { id: 'systemUpdate', method: 'POST', path: '/api/system/update', access: 'admin', write: true, usedBy: [] },
  { id: 'users', method: 'GET', path: '/api/user', access: 'admin', usedBy: [] },
];

export const accessUse = (access: GameTracker_Access) => {
  const calls = GAMETRACKER_USED_CALLS.filter((call) => call.access === access);
  if (calls.some((call) => call.write)) return 'write';
  if (calls.length) return 'read';
  return 'none';
};
