import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import {
  createTrekAdminClient,
  TrekRateLimitError,
  TrekRawBackup,
} from 'src/trek/trek.client';
import { BackupFile } from './backupSources';

/**
 * O backup do TREK: pede ao TREK um zip novo (base de dados, uploads e a
 * chave de encriptação) e devolve-o em stream. Se o TREK disser que já fez
 * backups demais nesta hora, usa o mais recente que lá estiver. O zip que o
 * MyHomeLab pediu é apagado do TREK depois de guardado (`cleanup`).
 */
export async function trekBackup(
  account: ConnectedAccount,
): Promise<BackupFile> {
  if (!account.baseUrl || !account.username || !account.appPassword) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O TREK já não tem a password guardada. Liga-o outra vez em Apps ligadas.',
    );
  }
  const client = createTrekAdminClient(
    account.baseUrl,
    account.username,
    account.appPassword,
  );
  let created: TrekRawBackup | null = null;
  try {
    created = await client.createBackup();
  } catch (error) {
    if (!(error instanceof TrekRateLimitError)) throw error;
  }

  const source = created ?? (await client.listBackups())[0];
  if (!source) {
    throw new AppIntegrationError(
      'APP_UNREACHABLE',
      'O TREK não deixou fazer um backup agora e não tem nenhum guardado.',
    );
  }

  const file = await client.downloadBackup(source.filename);
  return {
    content: file.stream,
    sizeBytes: file.size ?? source.size ?? null,
    missing: [],
    cleanup: created
      ? () => client.deleteBackup(created.filename)
      : async () => {},
  };
}
