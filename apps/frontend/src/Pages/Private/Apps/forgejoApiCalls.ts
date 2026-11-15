export type Forgejo_Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type Forgejo_Consumer = 'status' | 'updates' | 'backups' | 'assistant';

export type Forgejo_Scope_Group =
  | 'user'
  | 'repository'
  | 'issue'
  | 'admin'
  | 'organization'
  | 'notification'
  | 'package'
  | 'misc';

export interface Forgejo_Api_Call {
  id: string;
  method: Forgejo_Method;
  path: string;
  scope: string | null;
  admin?: boolean;
  usedBy: Forgejo_Consumer[];
}

export const FORGEJO_API_BASE_PATH = '/api/v1';

export const FORGEJO_SCOPE_GROUPS: Forgejo_Scope_Group[] = ['user', 'repository', 'issue', 'admin', 'organization', 'notification', 'package', 'misc'];

const REPO = '/repos/{owner}/{repo}';

export const FORGEJO_USED_CALLS: Forgejo_Api_Call[] = [
  { id: 'me', method: 'GET', path: '/user', scope: 'read:user', usedBy: ['status', 'backups'] },
  { id: 'version', method: 'GET', path: '/version', scope: null, usedBy: ['status', 'updates'] },
  { id: 'userRepos', method: 'GET', path: '/user/repos', scope: 'read:repository', usedBy: ['status', 'backups', 'assistant'] },
  { id: 'reposSearch', method: 'GET', path: '/repos/search', scope: 'read:repository', admin: true, usedBy: ['status', 'backups'] },
  { id: 'bundle', method: 'GET', path: `${REPO}/archive/{branch}.bundle`, scope: 'read:repository', usedBy: ['backups'] },
  { id: 'issues', method: 'GET', path: `${REPO}/issues`, scope: 'read:issue', usedBy: ['backups', 'assistant'] },
  { id: 'issue', method: 'GET', path: `${REPO}/issues/{number}`, scope: 'read:issue', usedBy: ['assistant'] },
  { id: 'issueComments', method: 'GET', path: `${REPO}/issues/{number}/comments`, scope: 'read:issue', usedBy: ['assistant'] },
  { id: 'repoComments', method: 'GET', path: `${REPO}/issues/comments`, scope: 'read:issue', usedBy: ['backups'] },
  { id: 'labels', method: 'GET', path: `${REPO}/labels`, scope: 'read:issue', usedBy: ['backups'] },
  { id: 'milestones', method: 'GET', path: `${REPO}/milestones`, scope: 'read:issue', usedBy: ['backups'] },
  { id: 'issueCreate', method: 'POST', path: `${REPO}/issues`, scope: 'write:issue', usedBy: ['assistant'] },
  { id: 'commentCreate', method: 'POST', path: `${REPO}/issues/{number}/comments`, scope: 'write:issue', usedBy: ['assistant'] },
  { id: 'issueState', method: 'PATCH', path: `${REPO}/issues/{number}`, scope: 'write:issue', usedBy: ['assistant'] },
  { id: 'releases', method: 'GET', path: `${REPO}/releases`, scope: 'read:repository', usedBy: ['backups', 'assistant'] },
  { id: 'commits', method: 'GET', path: `${REPO}/commits`, scope: 'read:repository', usedBy: ['assistant'] },
  { id: 'actionTasks', method: 'GET', path: `${REPO}/actions/tasks`, scope: 'read:repository', usedBy: ['assistant'] },
  { id: 'cronList', method: 'GET', path: '/admin/cron', scope: 'read:admin', admin: true, usedBy: ['backups'] },
  { id: 'cronArchives', method: 'POST', path: '/admin/cron/delete_repo_archives', scope: 'write:admin', admin: true, usedBy: ['backups'] },
];

export const FORGEJO_POSSIBLE_CALLS: Forgejo_Api_Call[] = [
  { id: 'branches', method: 'GET', path: `${REPO}/branches`, scope: 'read:repository', usedBy: [] },
  { id: 'contents', method: 'GET', path: `${REPO}/contents/{path}`, scope: 'read:repository', usedBy: [] },
  { id: 'pulls', method: 'GET', path: `${REPO}/pulls`, scope: 'read:repository', usedBy: [] },
  { id: 'pullCreate', method: 'POST', path: `${REPO}/pulls`, scope: 'write:repository', usedBy: [] },
  { id: 'pullMerge', method: 'POST', path: `${REPO}/pulls/{number}/merge`, scope: 'write:repository', usedBy: [] },
  { id: 'releaseCreate', method: 'POST', path: `${REPO}/releases`, scope: 'write:repository', usedBy: [] },
  { id: 'hooks', method: 'GET', path: `${REPO}/hooks`, scope: 'read:repository', usedBy: [] },
  { id: 'hookCreate', method: 'POST', path: `${REPO}/hooks`, scope: 'write:repository', usedBy: [] },
  { id: 'mirrorSync', method: 'POST', path: `${REPO}/mirror-sync`, scope: 'write:repository', usedBy: [] },
  { id: 'repoCreate', method: 'POST', path: '/user/repos', scope: 'write:repository', usedBy: [] },
  { id: 'repoDelete', method: 'DELETE', path: REPO, scope: 'write:repository', usedBy: [] },
  { id: 'issueLabels', method: 'POST', path: `${REPO}/issues/{number}/labels`, scope: 'write:issue', usedBy: [] },
  { id: 'notifications', method: 'GET', path: '/notifications', scope: 'read:notification', usedBy: [] },
  { id: 'orgs', method: 'GET', path: '/user/orgs', scope: 'read:organization', usedBy: [] },
  { id: 'packages', method: 'GET', path: '/packages/{owner}', scope: 'read:package', usedBy: [] },
  { id: 'adminUsers', method: 'GET', path: '/admin/users', scope: 'read:admin', admin: true, usedBy: [] },
  { id: 'cronRun', method: 'POST', path: '/admin/cron/{task}', scope: 'write:admin', admin: true, usedBy: [] },
];

export const scopeUse = (group: Forgejo_Scope_Group) => {
  const scopes = FORGEJO_USED_CALLS.map((call) => call.scope);
  if (scopes.includes(`write:${group}`)) return 'write';
  if (scopes.includes(`read:${group}`)) return 'read';
  return 'none';
};
