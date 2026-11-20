import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { createDispatcharrClient } from 'src/dispatcharr/dispatcharr.client';
import { BackupFile } from './backupSources';

/**
 * O backup do Dispatcharr: pede-lhe um backup novo (o zip que ele próprio faz, com a base de
 * dados: canais, grupos, contas M3U, fontes de EPG, perfis, utilizadores e definições), espera
 * que acabe e devolve-o em stream. Depois de guardado, o zip que o MyHomeLab pediu é apagado do
 * Dispatcharr (`cleanup`); os backups automáticos dele ficam onde estão. Os logótipos em cache
 * e as gravações do DVR não entram.
 */
export async function dispatcharrBackup(
  account: ConnectedAccount,
): Promise<BackupFile> {
  if (!account.baseUrl || !account.accessToken) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O Dispatcharr já não tem chave. Liga-o outra vez em Apps ligadas.',
    );
  }
  const client = createDispatcharrClient(account.baseUrl, account.accessToken);
  const filename = await client.createBackup();
  const file = await client.downloadBackup(filename);
  return {
    content: file.stream,
    sizeBytes: file.size,
    missing: [],
    cleanup: async () => {
      await client.deleteBackup(filename).catch(() => undefined);
    },
  };
}
