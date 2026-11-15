import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { createHomeAssistantClient } from 'src/home-assistant/home-assistant.client';
import { BackupFile } from './backupSources';

interface HaBackupInfo {
  backups: { backup_id: string; name: string }[];
  state: string;
}

const POLL_MS = 5_000;
const MAX_WAIT_MS = 60 * 60 * 1000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitUntilIdle(
  client: ReturnType<typeof createHomeAssistantClient>,
) {
  const started = Date.now();
  for (;;) {
    const [info] = (await client.socket([{ type: 'backup/info' }])) as [
      HaBackupInfo,
    ];
    if (!info.state || info.state === 'idle') return;
    if (Date.now() - started > MAX_WAIT_MS) {
      throw new AppIntegrationError(
        'APP_UNREACHABLE',
        `O Home Assistant está ocupado há mais de uma hora (${info.state}).`,
      );
    }
    await wait(POLL_MS * 2);
  }
}

/**
 * O backup do Home Assistant: pede ao HA um backup completo no disco dele
 * (`backup/generate`, com a base de dados e, com Supervisor, os add-ons e as
 * pastas), espera que acabe, devolve o .tar em stream e, no `cleanup`, apaga-o
 * do HA — fica só a cópia no destino. Precisa de um token de admin e do HA
 * 2025.1+. Sem password, o .tar não vai encriptado.
 */
export async function homeAssistantBackup(
  account: ConnectedAccount,
): Promise<BackupFile> {
  if (!account.baseUrl || !account.accessToken) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O Home Assistant já não tem o token guardado. Liga-o outra vez em Apps ligadas.',
    );
  }
  const client = createHomeAssistantClient(
    account.baseUrl,
    account.accessToken,
  );

  const [agentsResult] = (await client.socket([
    { type: 'backup/agents/info' },
  ])) as [{ agents: { agent_id: string }[] }];
  const agentIds = agentsResult.agents.map((agent) => agent.agent_id);
  const localAgent = ['hassio.local', 'backup.local'].find((id) =>
    agentIds.includes(id),
  );
  if (!localAgent) {
    throw new AppIntegrationError(
      'APP_NOT_SUPPORTED',
      'Este Home Assistant não tem onde guardar backups no próprio disco.',
    );
  }
  const supervisor = localAgent === 'hassio.local';
  const name = `MyHomeLab ${new Date().toISOString()}`;
  const generate = () =>
    client.socket([
      {
        type: 'backup/generate',
        agent_ids: [localAgent],
        name,
        include_homeassistant: true,
        include_database: true,
        ...(supervisor
          ? {
              include_all_addons: true,
              include_folders: ['share', 'addons/local', 'ssl', 'media'],
            }
          : {}),
      },
    ]);

  // O HA só faz um backup (ou restauro) de cada vez: se estiver ocupado, por
  // exemplo com o backup automático dele, espera-se que acabe.
  await waitUntilIdle(client);
  try {
    await generate();
  } catch (error) {
    if (!(error instanceof Error) || !/busy/i.test(error.message)) throw error;
    await waitUntilIdle(client);
    await generate();
  }

  const started = Date.now();
  let backupId: string | null = null;
  while (!backupId) {
    await wait(POLL_MS);
    const [info] = (await client.socket([{ type: 'backup/info' }])) as [
      HaBackupInfo,
    ];
    const done = info.backups.find((backup) => backup.name === name);
    if (done) backupId = done.backup_id;
    else if (info.state === 'idle' && Date.now() - started > 3 * POLL_MS) {
      throw new AppIntegrationError(
        'APP_UNREACHABLE',
        'O Home Assistant não conseguiu fazer o backup (vê o registo do HA).',
      );
    } else if (Date.now() - started > MAX_WAIT_MS) {
      throw new AppIntegrationError(
        'APP_UNREACHABLE',
        'O backup do Home Assistant demorou mais de uma hora.',
      );
    }
  }

  const file = await client.downloadBackup(backupId, localAgent);
  const size = Number(file.size);
  return {
    content: file.stream,
    sizeBytes: Number.isFinite(size) && size > 0 ? size : null,
    missing: [],
    cleanup: async () => {
      await client.socket([{ type: 'backup/delete', backup_id: backupId }]);
    },
  };
}
