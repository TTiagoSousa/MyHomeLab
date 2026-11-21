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
  HOME_ASSISTANT: { icon: Icon.HomeAssistant, titleKey: 'apps.homeAssistant.title', listPath: '/MyHomeLab/Apps/HomeAssistant', hosting: 'both' },
  ADGUARD: { icon: Icon.Adguard, titleKey: 'apps.adguard.title', listPath: '/MyHomeLab/Apps/AdGuard', hosting: 'selfHosted' },
  OPENGYM: { icon: Icon.OpenGym, titleKey: 'apps.openGym.title', listPath: '/MyHomeLab/Apps/OpenGym', hosting: 'selfHosted' },
  GAMETRACKER: { icon: Icon.GameTracker, titleKey: 'apps.gameTracker.title', listPath: '/MyHomeLab/Apps/GameTracker', hosting: 'selfHosted' },
  IMMICH: { icon: Icon.Immich, titleKey: 'apps.immich.title', listPath: '/MyHomeLab/Apps/Immich', hosting: 'selfHosted' },
  PAPERLESS: { icon: Icon.Paperless, titleKey: 'apps.paperless.title', listPath: '/MyHomeLab/Apps/Paperless', hosting: 'selfHosted' },
  SOLIDTIME: { icon: Icon.Solidtime, titleKey: 'apps.solidtime.title', listPath: '/MyHomeLab/Apps/Solidtime', hosting: 'selfHosted' },
  STIRLING_PDF: { icon: Icon.StirlingPdf, titleKey: 'apps.stirling.title', listPath: '/MyHomeLab/Apps/StirlingPDF', hosting: 'selfHosted' },
  PLANE: { icon: Icon.Plane, titleKey: 'apps.plane.title', listPath: '/MyHomeLab/Apps/Plane', hosting: 'selfHosted' },
  GITEA_MIRROR: { icon: Icon.GiteaMirror, titleKey: 'apps.giteaMirror.title', listPath: '/MyHomeLab/Apps/GiteaMirror', hosting: 'selfHosted' },
  INFISICAL: { icon: Icon.Infisical, titleKey: 'apps.infisical.title', listPath: '/MyHomeLab/Apps/Infisical', hosting: 'selfHosted' },
  VAULTWARDEN: { icon: Icon.Vaultwarden, titleKey: 'apps.vaultwarden.title', listPath: '/MyHomeLab/Apps/Vaultwarden', hosting: 'selfHosted' },
  POSTGRES: { icon: Icon.Postgres, titleKey: 'apps.postgres.title', listPath: '/MyHomeLab/Apps/Postgres', hosting: 'selfHosted' },
  CLICKHOUSE: { icon: Icon.ClickHouse, titleKey: 'apps.clickhouse.title', listPath: '/MyHomeLab/Apps/ClickHouse', hosting: 'selfHosted' },
  NGINX_PROXY_MANAGER: { icon: Icon.NginxProxyManager, titleKey: 'apps.nginxProxyManager.title', listPath: '/MyHomeLab/Apps/NginxProxyManager', hosting: 'selfHosted' },
  TPLINK_ROUTER: { icon: Icon.TplinkRouter, titleKey: 'apps.tplinkRouter.title', listPath: '/MyHomeLab/Apps/TplinkRouter', hosting: 'selfHosted' },
  COOLIFY: { icon: Icon.Coolify, titleKey: 'apps.coolify.title', listPath: '/MyHomeLab/Apps/Coolify', hosting: 'selfHosted' },
  DISPATCHARR: { icon: Icon.Dispatcharr, titleKey: 'apps.dispatcharr.title', listPath: '/MyHomeLab/Apps/Dispatcharr', hosting: 'selfHosted' },
  JELLYFIN: { icon: Icon.Jellyfin, titleKey: 'apps.jellyfin.title', listPath: '/MyHomeLab/Apps/Jellyfin', hosting: 'selfHosted' },
  GOOGLE_TASKS: { icon: Icon.GoogleTasks, titleKey: 'apps.googleTasks.title', listPath: '/MyHomeLab/Apps/GoogleTasks', hosting: 'cloud' },
  GOOGLE_DRIVE: { icon: Icon.GoogleDrive, titleKey: 'apps.googleDrive.title', listPath: '/MyHomeLab/Apps/GoogleDrive', hosting: 'cloud' },
  GMAIL: { icon: Icon.Gmail, titleKey: 'apps.gmail.title', listPath: '/MyHomeLab/Apps/Gmail', hosting: 'cloud' },
  OUTLOOK: { icon: Icon.Mail, titleKey: 'apps.types.OUTLOOK', hosting: 'cloud' },
  IMAP: { icon: Icon.Mail, titleKey: 'apps.types.IMAP', hosting: 'both' },
};

export const scrollToSection = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
