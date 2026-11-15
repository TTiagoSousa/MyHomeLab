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
  };
