import { APP_PAGES } from '../../Constants/appPages';
import type { AppNotification } from './useNotifications';

export const SUMMARY_PREFIX = 'daily-summary:';
const ASK_PREFIXES = ['update-waiting:', 'doc-proposal:'];

export const isAsk = (notification: AppNotification) => ASK_PREFIXES.some((prefix) => notification.subject?.startsWith(prefix));

export const askPage = (notification: AppNotification) => {
  const [, , taskId] = notification.subject?.split(':') ?? [];
  return taskId ? `/MyHomeLab/Projects/${taskId}` : '/MyHomeLab/Docs';
};

const RESULT_PREFIX = 'update-result:';

export const appPage = (notification: AppNotification) => {
  if (notification.subject?.startsWith(RESULT_PREFIX)) {
    const [, , taskId] = notification.subject.split(':');
    if (taskId) return `/MyHomeLab/Projects/${taskId}`;
  }
  if (notification.kind === 'APP_UPDATE' && notification.serverConnectionId) {
    return `/MyHomeLab/Apps/Proxmox/${notification.serverConnectionId}`;
  }
  const page = notification.connectedAccount && APP_PAGES[notification.connectedAccount.provider];
  if (!page) return null;
  return `${page}/${notification.connectedAccountId}`;
};
