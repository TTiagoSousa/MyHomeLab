import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { createOpenGymClient } from 'src/opengym/opengym.client';
import { BackupFile } from './backupSources';

/**
 * O backup do openGym: o estado inteiro do perfil emparelhado (rotinas, treinos,
 * peso, exercícios próprios, definições), tal como o /api/data o devolve, num JSON.
 * É o mesmo documento que a app importa de volta. As fotos e os vídeos dos
 * exercícios próprios não vão (só as referências): esses ficam no backup da máquina.
 */
export async function openGymBackup(
  account: ConnectedAccount,
): Promise<BackupFile> {
  if (!account.baseUrl || !account.accessToken) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O openGym já não tem token. Liga-o outra vez em Apps ligadas, com um código novo.',
    );
  }
  const data = await createOpenGymClient(
    account.baseUrl,
    account.accessToken,
  ).data();
  const content = Buffer.from(
    JSON.stringify(
      {
        app: 'openGym',
        server: account.baseUrl,
        exportedAt: new Date().toISOString(),
        version: account.appVersion,
        rev: data.rev,
        state: data.state,
      },
      null,
      2,
    ),
  );
  return { content, sizeBytes: content.length, missing: [] };
}
