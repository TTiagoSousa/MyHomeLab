import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { createGameTrackerClient } from 'src/gametracker/gametracker.client';
import { BackupFile } from './backupSources';

/**
 * O backup do GamesTracker: pede ao próprio GamesTracker um backup novo da base de
 * dados (pg_dump, gzip) e descarrega-o. Precisa do token de um admin — os backups são
 * só para admins lá; com outro token falha e diz porquê.
 */
export async function gameTrackerBackup(
  account: ConnectedAccount,
): Promise<BackupFile> {
  if (!account.baseUrl || !account.accessToken) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O GamesTracker já não tem token. Liga-o outra vez em Apps ligadas.',
    );
  }
  if (!account.isAdmin) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'Os backups do GamesTracker precisam do token de um admin (o deste utilizador não é).',
    );
  }
  const client = createGameTrackerClient(account.baseUrl, account.accessToken);
  const { backup } = await client.createBackup();
  const content = Buffer.from(await client.downloadBackup(backup.name));
  return { content, sizeBytes: content.length, missing: [] };
}
