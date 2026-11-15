export type Proxmox_Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'SSH';

export type Proxmox_Consumer = 'status' | 'updates' | 'disks' | 'assistant' | 'commands';

export interface Proxmox_Api_Call {
  id: string;
  method: Proxmox_Method;
  path: string;
  privileges: string[];
  usedBy: Proxmox_Consumer[];
}

export const PROXMOX_API_BASE_PATH = '/api2/json';

export const PROXMOX_PRIVILEGES = [
  'Sys.Audit',
  'VM.Audit',
  'VM.PowerMgmt',
  'VM.Snapshot',
  'VM.Snapshot.Rollback',
  'VM.Backup',
  'VM.Config.Memory',
  'VM.Config.CPU',
  'VM.Config.Disk',
  'Datastore.Audit',
  'Datastore.AllocateSpace',
  'Sys.Modify',
  'Sys.PowerMgmt',
  'Sys.Syslog',
  'VM.Allocate',
  'VM.Clone',
  'VM.Migrate',
  'VM.Console',
];

export const privilegeKey = (privilege: string) => privilege.replace(/\./g, '_');

const NODE = '/nodes/{node}';
const GUEST = `${NODE}/{qemu|lxc}/{vmid}`;

export const PROXMOX_USED_CALLS: Proxmox_Api_Call[] = [
  { id: 'version', method: 'GET', path: '/version', privileges: [], usedBy: ['status', 'updates'] },
  { id: 'nodes', method: 'GET', path: '/nodes', privileges: ['Sys.Audit'], usedBy: ['status', 'updates', 'disks'] },
  { id: 'guests', method: 'GET', path: `${NODE}/{qemu|lxc}`, privileges: ['VM.Audit'], usedBy: ['status', 'updates', 'assistant'] },
  { id: 'resources', method: 'GET', path: '/cluster/resources', privileges: ['VM.Audit', 'Sys.Audit'], usedBy: ['status', 'updates', 'disks'] },
  { id: 'nodeStatus', method: 'GET', path: `${NODE}/status`, privileges: ['Sys.Audit'], usedBy: ['status', 'updates'] },
  { id: 'nodeHistory', method: 'GET', path: `${NODE}/rrddata`, privileges: ['Sys.Audit'], usedBy: ['status'] },
  { id: 'aptUpdates', method: 'GET', path: `${NODE}/apt/update`, privileges: ['Sys.Audit'], usedBy: ['updates'] },
  { id: 'aptChangelog', method: 'GET', path: `${NODE}/apt/changelog`, privileges: ['Sys.Audit'], usedBy: ['updates'] },
  { id: 'disks', method: 'GET', path: `${NODE}/disks/list`, privileges: ['Sys.Audit'], usedBy: ['disks'] },
  { id: 'smart', method: 'GET', path: `${NODE}/disks/smart`, privileges: ['Sys.Audit'], usedBy: ['disks'] },
  { id: 'zfs', method: 'GET', path: `${NODE}/disks/zfs`, privileges: ['Sys.Audit'], usedBy: ['disks'] },
  { id: 'guestConfig', method: 'GET', path: `${GUEST}/config`, privileges: ['VM.Audit'], usedBy: ['assistant'] },
  { id: 'guestStatus', method: 'GET', path: `${GUEST}/status/current`, privileges: ['VM.Audit'], usedBy: ['assistant'] },
  { id: 'guestPower', method: 'POST', path: `${GUEST}/status/{start|stop|shutdown|reboot}`, privileges: ['VM.PowerMgmt'], usedBy: ['assistant', 'updates'] },
  { id: 'snapshots', method: 'GET', path: `${GUEST}/snapshot`, privileges: ['VM.Audit'], usedBy: ['assistant', 'updates', 'commands'] },
  { id: 'snapshotCreate', method: 'POST', path: `${GUEST}/snapshot`, privileges: ['VM.Snapshot'], usedBy: ['assistant', 'updates', 'commands'] },
  { id: 'snapshotRollback', method: 'POST', path: `${GUEST}/snapshot/{name}/rollback`, privileges: ['VM.Snapshot.Rollback'], usedBy: ['assistant', 'updates'] },
  { id: 'snapshotDelete', method: 'DELETE', path: `${GUEST}/snapshot/{name}`, privileges: ['VM.Snapshot'], usedBy: ['assistant', 'commands'] },
  { id: 'storages', method: 'GET', path: `${NODE}/storage`, privileges: ['Datastore.Audit'], usedBy: ['assistant'] },
  { id: 'backupNow', method: 'POST', path: `${NODE}/vzdump`, privileges: ['VM.Backup', 'Datastore.AllocateSpace'], usedBy: ['assistant'] },
  { id: 'setConfig', method: 'PUT', path: `${GUEST}/config`, privileges: ['VM.Config.Memory', 'VM.Config.CPU'], usedBy: ['assistant'] },
  { id: 'resizeDisk', method: 'PUT', path: `${GUEST}/resize`, privileges: ['VM.Config.Disk'], usedBy: ['assistant'] },
  { id: 'taskStatus', method: 'GET', path: `${NODE}/tasks/{upid}/status`, privileges: [], usedBy: ['assistant', 'updates', 'commands'] },
  { id: 'sshHost', method: 'SSH', path: 'root@{host}: comando no host', privileges: [], usedBy: ['commands', 'updates', 'assistant'] },
  { id: 'sshGuest', method: 'SSH', path: 'pct exec {vmid} · qm guest exec {vmid}', privileges: [], usedBy: ['commands', 'updates', 'assistant'] },
];

export const PROXMOX_POSSIBLE_CALLS: Proxmox_Api_Call[] = [
  { id: 'permissions', method: 'GET', path: '/access/permissions', privileges: [], usedBy: [] },
  { id: 'tasks', method: 'GET', path: `${NODE}/tasks`, privileges: ['Sys.Audit'], usedBy: [] },
  { id: 'syslog', method: 'GET', path: `${NODE}/syslog`, privileges: ['Sys.Syslog'], usedBy: [] },
  { id: 'network', method: 'GET', path: `${NODE}/network`, privileges: ['Sys.Audit'], usedBy: [] },
  { id: 'storageContent', method: 'GET', path: `${NODE}/storage/{storage}/content`, privileges: ['Datastore.Audit'], usedBy: [] },
  { id: 'backupJobs', method: 'GET', path: '/cluster/backup', privileges: ['Sys.Audit'], usedBy: [] },
  { id: 'backupJobCreate', method: 'POST', path: '/cluster/backup', privileges: ['Sys.Modify'], usedBy: [] },
  { id: 'haStatus', method: 'GET', path: '/cluster/ha/status/current', privileges: ['Sys.Audit'], usedBy: [] },
  { id: 'firewallRules', method: 'GET', path: '/cluster/firewall/rules', privileges: ['Sys.Audit'], usedBy: [] },
  { id: 'aptRefresh', method: 'POST', path: `${NODE}/apt/update`, privileges: ['Sys.Modify'], usedBy: [] },
  { id: 'nodePower', method: 'POST', path: `${NODE}/status`, privileges: ['Sys.PowerMgmt'], usedBy: [] },
  { id: 'guestCreate', method: 'POST', path: `${NODE}/{qemu|lxc}`, privileges: ['VM.Allocate'], usedBy: [] },
  { id: 'guestClone', method: 'POST', path: `${GUEST}/clone`, privileges: ['VM.Clone'], usedBy: [] },
  { id: 'guestMigrate', method: 'POST', path: `${GUEST}/migrate`, privileges: ['VM.Migrate'], usedBy: [] },
  { id: 'guestDelete', method: 'DELETE', path: GUEST, privileges: ['VM.Allocate'], usedBy: [] },
  { id: 'guestConsole', method: 'POST', path: `${GUEST}/vncproxy`, privileges: ['VM.Console'], usedBy: [] },
];

export const privilegeUsed = (privilege: string) => PROXMOX_USED_CALLS.some((call) => call.privileges.includes(privilege));
