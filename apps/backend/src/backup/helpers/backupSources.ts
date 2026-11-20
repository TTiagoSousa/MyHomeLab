import { Readable } from 'stream';
import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import { forgejoBackup } from './forgejoBackup';
import { trekBackup } from './trekBackup';
import { homeAssistantBackup } from './homeAssistantBackup';
import { adguardBackup } from './adguardBackup';
import { nextcloudBackup } from './nextcloudBackup';
import { openGymBackup } from './openGymBackup';
import { gameTrackerBackup } from './gameTrackerBackup';
import { immichBackup } from './immichBackup';
import { paperlessBackup } from './paperlessBackup';
import { solidtimeBackup } from './solidtimeBackup';
import { stirlingBackup } from './stirlingBackup';
import { infisicalBackup } from './infisicalBackup';
import { vaultwardenBackup } from './vaultwardenBackup';
import { postgresBackup } from './postgresBackup';
import { clickhouseBackup } from './clickhouseBackup';
import { nginxProxyManagerBackup } from './nginxProxyManagerBackup';
import { coolifyBackup } from './coolifyBackup';
import { dispatcharrBackup } from './dispatcharrBackup';
import { jellyfinBackup } from './jellyfinBackup';
import { planeBackup } from './planeBackup';

/** O ficheiro que uma app entrega para guardar no destino. */
export interface BackupFile {
  content: Buffer | Readable;
  sizeBytes: number | null;
  /** O que ficou de fora (ex: um repositório cujo código não veio). */
  missing: string[];
  /** Arruma o que se criou só para este backup (ex: os ficheiros temporários). */
  cleanup?: () => Promise<void>;
}

export interface BackupSource {
  /** Início do nome dos ficheiros, ex: "forgejo" → forgejo-2026-10-29_030000.tar */
  prefix: string;
  extension: 'json' | 'zip' | 'tar' | 'sql.gz';
  defaultFolder: string;
  create: (account: ConnectedAccount, options: unknown) => Promise<BackupFile>;
}

/**
 * As apps ligadas que sabem fazer backup. Todas usam o mesmo trabalho (destino,
 * pasta, frequência, quantos guardar); uma app nova é só mais uma entrada aqui.
 */
export const BACKUP_SOURCES: Partial<Record<ConnectionProvider, BackupSource>> =
  {
    [ConnectionProvider.FORGEJO]: {
      prefix: 'forgejo',
      extension: 'tar',
      defaultFolder: 'Forgejo',
      create: forgejoBackup,
    },
    [ConnectionProvider.TREK]: {
      prefix: 'trek',
      extension: 'zip',
      defaultFolder: 'TREK',
      create: trekBackup,
    },
    [ConnectionProvider.HOME_ASSISTANT]: {
      prefix: 'home-assistant',
      extension: 'tar',
      defaultFolder: 'Home Assistant',
      create: homeAssistantBackup,
    },
    [ConnectionProvider.ADGUARD]: {
      prefix: 'adguard',
      extension: 'json',
      defaultFolder: 'AdGuard',
      create: adguardBackup,
    },
    [ConnectionProvider.NEXTCLOUD]: {
      prefix: 'nextcloud',
      extension: 'tar',
      defaultFolder: 'Nextcloud',
      create: nextcloudBackup,
    },
    [ConnectionProvider.OPENGYM]: {
      prefix: 'opengym',
      extension: 'json',
      defaultFolder: 'openGym',
      create: openGymBackup,
    },
    [ConnectionProvider.GAMETRACKER]: {
      prefix: 'gametracker',
      extension: 'sql.gz',
      defaultFolder: 'GamesTracker',
      create: gameTrackerBackup,
    },
    [ConnectionProvider.IMMICH]: {
      prefix: 'immich',
      extension: 'sql.gz',
      defaultFolder: 'Immich',
      create: immichBackup,
    },
    [ConnectionProvider.PAPERLESS]: {
      prefix: 'paperless',
      extension: 'json',
      defaultFolder: 'Paperless',
      create: paperlessBackup,
    },
    [ConnectionProvider.SOLIDTIME]: {
      prefix: 'solidtime',
      extension: 'zip',
      defaultFolder: 'solidtime',
      create: solidtimeBackup,
    },
    [ConnectionProvider.STIRLING_PDF]: {
      prefix: 'stirling-pdf',
      extension: 'json',
      defaultFolder: 'Stirling-PDF',
      create: stirlingBackup,
    },
    [ConnectionProvider.INFISICAL]: {
      prefix: 'infisical',
      extension: 'json',
      defaultFolder: 'Infisical',
      create: infisicalBackup,
    },
    [ConnectionProvider.VAULTWARDEN]: {
      prefix: 'vaultwarden',
      extension: 'json',
      defaultFolder: 'Vaultwarden',
      create: vaultwardenBackup,
    },
    [ConnectionProvider.POSTGRES]: {
      prefix: 'postgres',
      extension: 'sql.gz',
      defaultFolder: 'PostgreSQL',
      create: postgresBackup,
    },
    [ConnectionProvider.CLICKHOUSE]: {
      prefix: 'clickhouse',
      extension: 'json',
      defaultFolder: 'ClickHouse',
      create: clickhouseBackup,
    },
    [ConnectionProvider.NGINX_PROXY_MANAGER]: {
      prefix: 'nginx-proxy-manager',
      extension: 'json',
      defaultFolder: 'Nginx Proxy Manager',
      create: nginxProxyManagerBackup,
    },
    [ConnectionProvider.COOLIFY]: {
      prefix: 'coolify',
      extension: 'json',
      defaultFolder: 'Coolify',
      create: coolifyBackup,
    },
    [ConnectionProvider.DISPATCHARR]: {
      prefix: 'dispatcharr',
      extension: 'zip',
      defaultFolder: 'Dispatcharr',
      create: dispatcharrBackup,
    },
    [ConnectionProvider.JELLYFIN]: {
      prefix: 'jellyfin',
      extension: 'json',
      defaultFolder: 'Jellyfin',
      create: jellyfinBackup,
    },
    [ConnectionProvider.PLANE]: {
      prefix: 'plane',
      extension: 'json',
      defaultFolder: 'Plane',
      create: planeBackup,
    },
  };
