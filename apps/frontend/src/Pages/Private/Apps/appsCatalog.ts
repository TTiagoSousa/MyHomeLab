import type { ComponentType } from 'react';
import type { ConnectionProvider } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import * as Icon from '../../../Imports/icons';

export type App_Kind = ConnectionProvider | 'PROXMOX';

interface App_Kind_Info {
  icon: ComponentType;
  titleKey: string;
  listPath?: string;
  hosting: 'selfHosted' | 'cloud' | 'both';
}

export const APP_KINDS: Record<App_Kind, App_Kind_Info> = {
  PROXMOX: { icon: Icon.Proxmox, titleKey: 'apps.proxmox.title', listPath: '/MyHomeLab/Apps/Proxmox', hosting: 'selfHosted' },
  NEXTCLOUD: { icon: Icon.Nextcloud, titleKey: 'apps.nextcloud.title', listPath: '/MyHomeLab/Apps/Nextcloud', hosting: 'both' },
  FORGEJO: { icon: Icon.Forgejo, titleKey: 'apps.forgejo.title', listPath: '/MyHomeLab/Apps/Forgejo', hosting: 'both' },
  TREK: { icon: Icon.Trek, titleKey: 'apps.trek.title', listPath: '/MyHomeLab/Apps/Trek', hosting: 'selfHosted' },
  HOME_ASSISTANT: { icon: Icon.House, titleKey: 'apps.homeAssistant.title', listPath: '/MyHomeLab/Apps/HomeAssistant', hosting: 'both' },
  ADGUARD: { icon: Icon.Adguard, titleKey: 'apps.adguard.title', listPath: '/MyHomeLab/Apps/AdGuard', hosting: 'selfHosted' },
  OPENGYM: { icon: Icon.OpenGym, titleKey: 'apps.openGym.title', listPath: '/MyHomeLab/Apps/OpenGym', hosting: 'selfHosted' },
  GAMETRACKER: { icon: Icon.GameTracker, titleKey: 'apps.gameTracker.title', listPath: '/MyHomeLab/Apps/GameTracker', hosting: 'selfHosted' },
  IMMICH: { icon: Icon.Immich, titleKey: 'apps.immich.title', listPath: '/MyHomeLab/Apps/Immich', hosting: 'selfHosted' },
  GOOGLE_TASKS: { icon: Icon.GoogleTasks, titleKey: 'apps.googleTasks.title', listPath: '/MyHomeLab/Apps/GoogleTasks', hosting: 'cloud' },
  GMAIL: { icon: Icon.Gmail, titleKey: 'apps.gmail.title', listPath: '/MyHomeLab/Apps/Gmail', hosting: 'cloud' },
  OUTLOOK: { icon: Icon.Mail, titleKey: 'apps.types.OUTLOOK', hosting: 'cloud' },
  IMAP: { icon: Icon.Mail, titleKey: 'apps.types.IMAP', hosting: 'both' },
};

export const scrollToSection = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
