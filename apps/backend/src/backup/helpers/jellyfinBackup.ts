import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { createJellyfinClient } from 'src/jellyfin/jellyfin.client';
import { BackupFile } from './backupSources';

/** Campos com segredos que não saem para o backup (a password do certificado HTTPS). */
const SECRET_KEYS = /(password|secret|token|apikey)$/i;

const withoutSecrets = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(withoutSecrets);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !SECRET_KEYS.test(key))
        .map(([key, inner]) => [key, withoutSecrets(inner)]),
    );
  }
  return value;
};

/**
 * O backup do Jellyfin: um JSON com a configuração que a API mostra — a do servidor, a de rede
 * e a de transcodificação, as bibliotecas (pastas e opções), os utilizadores com as regras e
 * as preferências (sem passwords), os plugins e os horários das tarefas agendadas. O Jellyfin
 * 10.11+ faz backups completos no próprio disco (/Backup), mas a API não os deixa descarregar;
 * a base de dados, as imagens e os metadados ficam fora deste ficheiro.
 */
export async function jellyfinBackup(
  account: ConnectedAccount,
): Promise<BackupFile> {
  if (!account.baseUrl || !account.accessToken) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O Jellyfin já não tem chave. Liga-o outra vez em Apps ligadas.',
    );
  }
  const client = createJellyfinClient(account.baseUrl, account.accessToken);
  const info = await client.info();
  const missing: string[] = [];
  const read = async <T>(key: string, work: () => Promise<T>) => {
    try {
      return await work();
    } catch (error) {
      if (
        error instanceof AppIntegrationError &&
        error.code === 'APP_AUTH_FAILED'
      ) {
        throw error;
      }
      missing.push(key);
      return null;
    }
  };

  const configuration = await read('configuration', client.configuration);
  const network = await read('network', () =>
    client.namedConfiguration('network'),
  );
  const encoding = await read('encoding', () =>
    client.namedConfiguration('encoding'),
  );
  const libraries = await read('libraries', client.libraries);
  const users = await read('users', client.users);
  const plugins = await read('plugins', client.plugins);
  const tasks = await read('tasks', client.tasks);
  const serverBackups = await read('serverBackups', client.serverBackups);

  const content = Buffer.from(
    JSON.stringify(
      {
        format: 'myhomelab-backup',
        formatVersion: 1,
        app: 'jellyfin',
        appVersion: info.Version,
        service: account.displayName ?? info.ServerName ?? 'Jellyfin',
        address: account.baseUrl,
        createdAt: new Date().toISOString(),
        missing,
        data: {
          server: { name: info.ServerName, id: info.Id },
          configuration: withoutSecrets(configuration),
          network: withoutSecrets(network),
          encoding: withoutSecrets(encoding),
          libraries,
          users: withoutSecrets(users),
          plugins,
          tasks: tasks?.map((task) => ({
            id: task.Id,
            key: task.Key,
            name: task.Name,
            category: task.Category,
            triggers: task.Triggers ?? [],
          })),
          serverBackups,
        },
      },
      null,
      2,
    ),
  );
  return { content, sizeBytes: content.length, missing };
}
