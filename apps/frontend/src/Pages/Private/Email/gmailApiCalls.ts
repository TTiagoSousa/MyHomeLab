export type Gmail_Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type Gmail_Consumer = 'rules' | 'proposals' | 'assistant' | 'stats';

export interface Gmail_Api_Call {
  id: string;
  method: Gmail_Method;
  path: string;
  scopes: string[];
  usedBy: Gmail_Consumer[];
}

const GOOGLE_SCOPE_PREFIX = 'https://www.googleapis.com/auth/';

export const GMAIL_FULL_ACCESS = 'https://mail.google.com/';

const scope = (name: string) => GOOGLE_SCOPE_PREFIX + name;

const READ = [scope('gmail.readonly'), scope('gmail.modify'), GMAIL_FULL_ACCESS];
const MODIFY = [scope('gmail.modify'), GMAIL_FULL_ACCESS];
const LABELS = [scope('gmail.labels'), scope('gmail.modify'), GMAIL_FULL_ACCESS];
const COMPOSE = [scope('gmail.compose'), scope('gmail.modify'), GMAIL_FULL_ACCESS];
const SEND = [scope('gmail.send'), scope('gmail.compose'), scope('gmail.modify'), GMAIL_FULL_ACCESS];
const SETTINGS = [scope('gmail.settings.basic')];
const FULL = [GMAIL_FULL_ACCESS];

export const GMAIL_SCOPES = [
  { id: 'readonly', value: scope('gmail.readonly'), includedIn: [scope('gmail.modify'), GMAIL_FULL_ACCESS] },
  { id: 'modify', value: scope('gmail.modify'), includedIn: [GMAIL_FULL_ACCESS] },
  { id: 'labels', value: scope('gmail.labels'), includedIn: [scope('gmail.modify'), GMAIL_FULL_ACCESS] },
  { id: 'compose', value: scope('gmail.compose'), includedIn: [scope('gmail.modify'), GMAIL_FULL_ACCESS] },
  { id: 'send', value: scope('gmail.send'), includedIn: [scope('gmail.compose'), scope('gmail.modify'), GMAIL_FULL_ACCESS] },
  { id: 'settingsBasic', value: scope('gmail.settings.basic'), includedIn: [] },
  { id: 'fullAccess', value: GMAIL_FULL_ACCESS, includedIn: [] },
];

export const GMAIL_API_BASE_PATH = 'gmail/v1/users/me';

export const GMAIL_USED_CALLS: Gmail_Api_Call[] = [
  { id: 'messagesList', method: 'GET', path: '/messages', scopes: READ, usedBy: ['rules', 'proposals', 'assistant'] },
  { id: 'messageGet', method: 'GET', path: '/messages/{id}', scopes: READ, usedBy: ['rules', 'proposals', 'assistant'] },
  { id: 'attachmentGet', method: 'GET', path: '/messages/{id}/attachments/{id}', scopes: READ, usedBy: ['assistant'] },
  { id: 'messageModify', method: 'POST', path: '/messages/{id}/modify', scopes: MODIFY, usedBy: ['rules', 'assistant'] },
  { id: 'messageTrash', method: 'POST', path: '/messages/{id}/trash', scopes: MODIFY, usedBy: ['assistant'] },
  { id: 'messageUntrash', method: 'POST', path: '/messages/{id}/untrash', scopes: MODIFY, usedBy: ['assistant'] },
  { id: 'labelsList', method: 'GET', path: '/labels', scopes: LABELS, usedBy: ['rules', 'assistant'] },
  { id: 'labelCreate', method: 'POST', path: '/labels', scopes: LABELS, usedBy: ['rules', 'assistant'] },
  { id: 'labelGet', method: 'GET', path: '/labels/{id}', scopes: LABELS, usedBy: ['stats', 'assistant'] },
  { id: 'draftCreate', method: 'POST', path: '/drafts', scopes: COMPOSE, usedBy: ['assistant'] },
  { id: 'draftGet', method: 'GET', path: '/drafts/{id}', scopes: COMPOSE, usedBy: ['assistant'] },
  { id: 'draftSend', method: 'POST', path: '/drafts/send', scopes: COMPOSE, usedBy: ['assistant'] },
  { id: 'profileGet', method: 'GET', path: '/profile', scopes: READ, usedBy: ['stats', 'assistant'] },
];

export const GMAIL_POSSIBLE_CALLS: Gmail_Api_Call[] = [
  { id: 'threadsList', method: 'GET', path: '/threads', scopes: READ, usedBy: [] },
  { id: 'threadGet', method: 'GET', path: '/threads/{id}', scopes: READ, usedBy: [] },
  { id: 'threadModify', method: 'POST', path: '/threads/{id}/modify', scopes: MODIFY, usedBy: [] },
  { id: 'threadTrash', method: 'POST', path: '/threads/{id}/trash', scopes: MODIFY, usedBy: [] },
  { id: 'historyList', method: 'GET', path: '/history', scopes: READ, usedBy: [] },
  { id: 'messagesBatchModify', method: 'POST', path: '/messages/batchModify', scopes: MODIFY, usedBy: [] },
  { id: 'messageSend', method: 'POST', path: '/messages/send', scopes: SEND, usedBy: [] },
  { id: 'labelPatch', method: 'PATCH', path: '/labels/{id}', scopes: LABELS, usedBy: [] },
  { id: 'labelDelete', method: 'DELETE', path: '/labels/{id}', scopes: LABELS, usedBy: [] },
  { id: 'draftsList', method: 'GET', path: '/drafts', scopes: COMPOSE, usedBy: [] },
  { id: 'draftUpdate', method: 'PUT', path: '/drafts/{id}', scopes: COMPOSE, usedBy: [] },
  { id: 'draftDelete', method: 'DELETE', path: '/drafts/{id}', scopes: COMPOSE, usedBy: [] },
  { id: 'watch', method: 'POST', path: '/watch', scopes: READ, usedBy: [] },
  { id: 'filtersList', method: 'GET', path: '/settings/filters', scopes: SETTINGS, usedBy: [] },
  { id: 'filterCreate', method: 'POST', path: '/settings/filters', scopes: SETTINGS, usedBy: [] },
  { id: 'filterDelete', method: 'DELETE', path: '/settings/filters/{id}', scopes: SETTINGS, usedBy: [] },
  { id: 'vacationGet', method: 'GET', path: '/settings/vacation', scopes: SETTINGS, usedBy: [] },
  { id: 'vacationUpdate', method: 'PUT', path: '/settings/vacation', scopes: SETTINGS, usedBy: [] },
  { id: 'messageDelete', method: 'DELETE', path: '/messages/{id}', scopes: FULL, usedBy: [] },
  { id: 'messagesBatchDelete', method: 'POST', path: '/messages/batchDelete', scopes: FULL, usedBy: [] },
];

export const shortScope = (value: string) =>
  value === GMAIL_FULL_ACCESS ? 'mail.google.com' : value.replace(GOOGLE_SCOPE_PREFIX, '');

