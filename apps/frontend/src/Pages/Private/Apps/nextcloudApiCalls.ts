export type Nextcloud_Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PROPFIND' | 'REPORT' | 'MKCOL';

export type Nextcloud_Consumer = 'status' | 'updates' | 'backups' | 'assistant' | 'tasks';

export type Nextcloud_Access = 'public' | 'user' | 'admin' | 'store';

export interface Nextcloud_Api_Call {
  id: string;
  method: Nextcloud_Method;
  path: string;
  access: Nextcloud_Access;
  write?: boolean;
  usedBy: Nextcloud_Consumer[];
}

export const NEXTCLOUD_ACCESS: Nextcloud_Access[] = ['public', 'user', 'admin', 'store'];

const OCS = '/ocs/v2.php';
const CALENDARS = '/remote.php/dav/calendars/{user}';
const CONTACTS = '/remote.php/dav/addressbooks/users/{user}';
const FILES = '/remote.php/dav/files/{user}';

export const NEXTCLOUD_USED_CALLS: Nextcloud_Api_Call[] = [
  { id: 'status', method: 'GET', path: '/status.php', access: 'public', usedBy: ['status', 'updates', 'backups', 'assistant'] },
  { id: 'me', method: 'GET', path: `${OCS}/cloud/user`, access: 'user', usedBy: ['status', 'backups', 'assistant', 'tasks'] },
  { id: 'myGroups', method: 'GET', path: `${OCS}/cloud/users/{user}/groups`, access: 'user', usedBy: ['status', 'updates'] },
  { id: 'appsList', method: 'GET', path: `${OCS}/cloud/apps?filter=enabled`, access: 'admin', usedBy: ['status', 'updates', 'backups', 'assistant'] },
  { id: 'appInfo', method: 'GET', path: `${OCS}/cloud/apps/{app}`, access: 'admin', usedBy: ['status', 'updates', 'assistant'] },
  { id: 'usersList', method: 'GET', path: `${OCS}/cloud/users`, access: 'admin', usedBy: ['backups'] },
  { id: 'groupsList', method: 'GET', path: `${OCS}/cloud/groups`, access: 'admin', usedBy: ['backups'] },
  { id: 'calendars', method: 'PROPFIND', path: `${CALENDARS}/`, access: 'user', usedBy: ['backups', 'tasks'] },
  { id: 'calendarExport', method: 'GET', path: `${CALENDARS}/{calendar}?export`, access: 'user', usedBy: ['backups'] },
  { id: 'addressBooks', method: 'PROPFIND', path: `${CONTACTS}/`, access: 'user', usedBy: ['backups'] },
  { id: 'addressBookExport', method: 'GET', path: `${CONTACTS}/{book}?export`, access: 'user', usedBy: ['backups'] },
  { id: 'listCreate', method: 'MKCOL', path: `${CALENDARS}/{list}`, access: 'user', write: true, usedBy: ['tasks'] },
  { id: 'tasksList', method: 'REPORT', path: `${CALENDARS}/{list}`, access: 'user', usedBy: ['tasks'] },
  { id: 'taskSave', method: 'PUT', path: `${CALENDARS}/{list}/{task}.ics`, access: 'user', write: true, usedBy: ['tasks'] },
  { id: 'taskDelete', method: 'DELETE', path: `${CALENDARS}/{list}/{task}.ics`, access: 'user', write: true, usedBy: ['tasks'] },
  { id: 'storeApps', method: 'GET', path: 'apps.nextcloud.com/api/v1/platform/{version}/apps.json', access: 'store', usedBy: ['status', 'updates', 'assistant'] },
];

export const NEXTCLOUD_POSSIBLE_CALLS: Nextcloud_Api_Call[] = [
  { id: 'filesList', method: 'PROPFIND', path: `${FILES}/{path}`, access: 'user', usedBy: [] },
  { id: 'fileGet', method: 'GET', path: `${FILES}/{path}`, access: 'user', usedBy: [] },
  { id: 'filePut', method: 'PUT', path: `${FILES}/{path}`, access: 'user', write: true, usedBy: [] },
  { id: 'folderCreate', method: 'MKCOL', path: `${FILES}/{path}`, access: 'user', write: true, usedBy: [] },
  { id: 'fileDelete', method: 'DELETE', path: `${FILES}/{path}`, access: 'user', write: true, usedBy: [] },
  { id: 'shares', method: 'GET', path: `${OCS}/apps/files_sharing/api/v1/shares`, access: 'user', usedBy: [] },
  { id: 'shareCreate', method: 'POST', path: `${OCS}/apps/files_sharing/api/v1/shares`, access: 'user', write: true, usedBy: [] },
  { id: 'eventSave', method: 'PUT', path: `${CALENDARS}/{calendar}/{event}.ics`, access: 'user', write: true, usedBy: [] },
  { id: 'contactSave', method: 'PUT', path: `${CONTACTS}/{book}/{contact}.vcf`, access: 'user', write: true, usedBy: [] },
  { id: 'notifications', method: 'GET', path: `${OCS}/apps/notifications/api/v2/notifications`, access: 'user', usedBy: [] },
  { id: 'activity', method: 'GET', path: `${OCS}/apps/activity/api/v2/activity`, access: 'user', usedBy: [] },
  { id: 'userStatus', method: 'GET', path: `${OCS}/apps/user_status/api/v1/user_status`, access: 'user', usedBy: [] },
  { id: 'talkMessage', method: 'POST', path: `${OCS}/apps/spreed/api/v1/chat/{room}`, access: 'user', write: true, usedBy: [] },
  { id: 'serverInfo', method: 'GET', path: `${OCS}/apps/serverinfo/api/v1/info`, access: 'admin', usedBy: [] },
  { id: 'adminNotification', method: 'POST', path: `${OCS}/apps/notifications/api/v2/admin_notifications/{user}`, access: 'admin', write: true, usedBy: [] },
  { id: 'appEnable', method: 'POST', path: `${OCS}/cloud/apps/{app}`, access: 'admin', write: true, usedBy: [] },
  { id: 'appDisable', method: 'DELETE', path: `${OCS}/cloud/apps/{app}`, access: 'admin', write: true, usedBy: [] },
  { id: 'userCreate', method: 'POST', path: `${OCS}/cloud/users`, access: 'admin', write: true, usedBy: [] },
];

export const accessUse = (access: Nextcloud_Access) => {
  const calls = NEXTCLOUD_USED_CALLS.filter((call) => call.access === access);
  if (calls.some((call) => call.write)) return 'write';
  if (calls.length) return 'read';
  return 'none';
};
