export type Paperless_Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type Paperless_Consumer = 'connect' | 'status' | 'updates' | 'assistant';

export type Paperless_Access = 'user' | 'admin' | 'github';

export interface Paperless_Api_Call {
  id: string;
  method: Paperless_Method;
  path: string;
  access: Paperless_Access;
  permission?: string;
  write?: boolean;
  usedBy: Paperless_Consumer[];
}

export const PAPERLESS_ACCESS: Paperless_Access[] = ['user', 'admin', 'github'];

export const PAPERLESS_USED_CALLS: Paperless_Api_Call[] = [
  { id: 'uiSettings', method: 'GET', path: '/api/ui_settings/', access: 'user', usedBy: ['connect', 'status', 'updates', 'assistant'] },
  { id: 'statistics', method: 'GET', path: '/api/statistics/', access: 'user', usedBy: ['status', 'assistant'] },
  { id: 'status', method: 'GET', path: '/api/status/', access: 'admin', usedBy: ['status', 'assistant'] },
  { id: 'tasks', method: 'GET', path: '/api/tasks/', access: 'user', permission: 'view_paperlesstask', usedBy: ['status', 'assistant'] },
  { id: 'documents', method: 'GET', path: '/api/documents/', access: 'user', permission: 'view_document', usedBy: ['assistant'] },
  { id: 'document', method: 'GET', path: '/api/documents/{id}/', access: 'user', permission: 'view_document', usedBy: ['assistant'] },
  { id: 'documentUpdate', method: 'PATCH', path: '/api/documents/{id}/', access: 'user', permission: 'change_document', write: true, usedBy: ['assistant'] },
  { id: 'noteAdd', method: 'POST', path: '/api/documents/{id}/notes/', access: 'user', permission: 'add_note', write: true, usedBy: ['assistant'] },
  { id: 'bulkEdit', method: 'POST', path: '/api/documents/bulk_edit/', access: 'user', permission: 'change_document', write: true, usedBy: ['assistant'] },
  { id: 'tags', method: 'GET', path: '/api/tags/', access: 'user', permission: 'view_tag', usedBy: ['assistant'] },
  { id: 'tagSave', method: 'POST', path: '/api/tags/', access: 'user', permission: 'add_tag', write: true, usedBy: ['assistant'] },
  { id: 'correspondents', method: 'GET', path: '/api/correspondents/', access: 'user', permission: 'view_correspondent', usedBy: ['assistant'] },
  { id: 'correspondentSave', method: 'POST', path: '/api/correspondents/', access: 'user', permission: 'add_correspondent', write: true, usedBy: ['assistant'] },
  { id: 'documentTypes', method: 'GET', path: '/api/document_types/', access: 'user', permission: 'view_documenttype', usedBy: ['assistant'] },
  { id: 'storagePaths', method: 'GET', path: '/api/storage_paths/', access: 'user', permission: 'view_storagepath', usedBy: ['assistant'] },
  { id: 'customFields', method: 'GET', path: '/api/custom_fields/', access: 'user', permission: 'view_customfield', usedBy: ['assistant'] },
  { id: 'savedViews', method: 'GET', path: '/api/saved_views/', access: 'user', permission: 'view_savedview', usedBy: [] },
  { id: 'workflows', method: 'GET', path: '/api/workflows/', access: 'user', permission: 'view_workflow', usedBy: ['assistant'] },
  { id: 'mailRules', method: 'GET', path: '/api/mail_rules/', access: 'user', permission: 'view_mailrule', usedBy: ['assistant'] },
  { id: 'mailAccounts', method: 'GET', path: '/api/mail_accounts/', access: 'user', permission: 'view_mailaccount', usedBy: [] },
  { id: 'config', method: 'GET', path: '/api/config/', access: 'admin', permission: 'view_applicationconfiguration', usedBy: ['assistant'] },
  { id: 'configUpdate', method: 'PATCH', path: '/api/config/{id}/', access: 'admin', permission: 'change_applicationconfiguration', write: true, usedBy: ['assistant'] },
  { id: 'releases', method: 'GET', path: 'api.github.com/repos/paperless-ngx/paperless-ngx/releases', access: 'github', usedBy: ['updates'] },
];

export const PAPERLESS_POSSIBLE_CALLS: Paperless_Api_Call[] = [
  { id: 'upload', method: 'POST', path: '/api/documents/post_document/', access: 'user', permission: 'add_document', write: true, usedBy: [] },
  { id: 'download', method: 'GET', path: '/api/documents/{id}/download/', access: 'user', permission: 'view_document', usedBy: [] },
  { id: 'documentDelete', method: 'DELETE', path: '/api/documents/{id}/', access: 'user', permission: 'delete_document', write: true, usedBy: [] },
  { id: 'globalSearch', method: 'GET', path: '/api/search/', access: 'user', usedBy: [] },
  { id: 'trash', method: 'GET', path: '/api/trash/', access: 'user', permission: 'delete_document', usedBy: [] },
  { id: 'shareLinks', method: 'GET', path: '/api/share_links/', access: 'user', permission: 'view_sharelink', usedBy: [] },
  { id: 'remoteVersion', method: 'GET', path: '/api/remote_version/', access: 'user', usedBy: [] },
  { id: 'users', method: 'GET', path: '/api/users/', access: 'admin', permission: 'view_user', usedBy: [] },
  { id: 'logs', method: 'GET', path: '/api/logs/', access: 'admin', permission: 'view_log', usedBy: [] },
];

export const accessUse = (access: Paperless_Access) => {
  const calls = PAPERLESS_USED_CALLS.filter((call) => call.access === access);
  if (calls.some((call) => call.write)) return 'write';
  if (calls.length) return 'read';
  return 'none';
};

export const userAllows = (permissions: string[] | null, isAdmin: boolean, permission?: string) =>
  !permission || isAdmin || permissions === null || permissions.includes(permission);
