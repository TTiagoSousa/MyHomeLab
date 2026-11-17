import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { createImmichClient } from 'src/immich/immich.client';
import { BackupFile } from './backupSources';

const WAIT_MS = 5 * 60_000;
const POLL_MS = 5_000;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * O backup do Immich: pede ao próprio Immich um backup novo da base de dados (a tarefa
 * backup-database, pg_dump com gzip), espera que o ficheiro apareça na lista e
 * descarrega-o. Só a base de dados (álbuns, pessoas, metadados, utilizadores,
 * definições): as fotos e os vídeos não entram. Precisa da chave de um admin.
 */
export async function immichBackup(
  account: ConnectedAccount,
): Promise<BackupFile> {
  if (!account.baseUrl || !account.accessToken) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O Immich já não tem chave de API. Liga-o outra vez em Apps ligadas.',
    );
  }
  if (!account.isAdmin) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'Os backups do Immich precisam da chave de um admin (a deste utilizador não é).',
    );
  }
  const client = createImmichClient(account.baseUrl, account.accessToken);
  const before = new Set(
    (await client.backups()).backups.map((backup) => backup.filename),
  );
  await client.runJob('backup-database');

  const deadline = Date.now() + WAIT_MS;
  let filename: string | undefined;
  while (!filename && Date.now() < deadline) {
    await pause(POLL_MS);
    const { backups } = await client.backups();
    // O ficheiro aparece antes de o pg_dump acabar: só conta quando o tamanho para.
    const fresh = backups.find((backup) => !before.has(backup.filename));
    if (fresh) {
      await pause(POLL_MS);
      const again = (await client.backups()).backups.find(
        (backup) => backup.filename === fresh.filename,
      );
      if (again && again.filesize > 0 && again.filesize === fresh.filesize) {
        filename = fresh.filename;
      }
    }
  }
  if (!filename) {
    throw new AppIntegrationError(
      'APP_UNREACHABLE',
      'O Immich não acabou o backup da base de dados em 5 minutos. Vê a fila backupDatabase em Administração → Tarefas.',
    );
  }
  const content = Buffer.from(await client.downloadBackup(filename));
  return { content, sizeBytes: content.length, missing: [] };
}
