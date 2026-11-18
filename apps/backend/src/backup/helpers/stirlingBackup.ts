import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { createStirlingClient } from 'src/stirling/stirling.client';
import { BackupFile } from './backupSources';

/**
 * O backup do Stirling-PDF: um JSON com as definições do servidor (só com uma chave de
 * administrador; os segredos vêm escondidos pelo próprio Stirling) e a lista das operações
 * desligadas. O Stirling não guarda documentos: os PDFs tratados ficam onde se gravaram.
 */
export async function stirlingBackup(
  account: ConnectedAccount,
): Promise<BackupFile> {
  if (!account.baseUrl || !account.accessToken) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O Stirling-PDF já não tem chave. Liga-o outra vez em Apps ligadas.',
    );
  }
  const client = createStirlingClient(account.baseUrl, account.accessToken);
  const status = await client.status();
  const missing: string[] = [];
  const settings = await client.settings().catch(() => {
    missing.push('settings');
    return null;
  });
  const endpoints = await client.disabledEndpoints().catch(() => {
    missing.push('endpoints');
    return null;
  });
  const content = Buffer.from(
    JSON.stringify(
      {
        app: 'stirling-pdf',
        version: status.version,
        createdAt: new Date().toISOString(),
        settings,
        endpoints,
      },
      null,
      2,
    ),
  );
  return { content, sizeBytes: content.length, missing };
}
