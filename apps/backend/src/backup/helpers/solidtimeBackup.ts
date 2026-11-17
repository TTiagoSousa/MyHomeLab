import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { createSolidtimeClient } from 'src/solidtime/solidtime.client';
import { BackupFile } from './backupSources';

/**
 * O backup do solidtime: o export da organização que o próprio solidtime faz (um zip com
 * os registos de horas, os projetos, os clientes, as tarefas, as etiquetas e os membros),
 * descarregado pelo link temporário que ele devolve. Precisa de um papel que possa
 * exportar (owner ou admin).
 */
export async function solidtimeBackup(
  account: ConnectedAccount,
): Promise<BackupFile> {
  if (!account.baseUrl || !account.accessToken) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O solidtime já não tem token. Liga-o outra vez em Apps ligadas.',
    );
  }
  const client = createSolidtimeClient(account.baseUrl, account.accessToken);
  const membership = (await client.memberships()).find(
    (item) => item.id === account.username,
  );
  if (!membership) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O utilizador do token já não está na organização desta ligação. Liga o solidtime outra vez.',
    );
  }
  const content = await client.exportOrganization(membership.organization.id);
  return { content, sizeBytes: content.length, missing: [] };
}
