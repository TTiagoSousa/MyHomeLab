import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { createPlaneClient, planeVersion } from 'src/plane/plane.client';
import { BackupFile } from './backupSources';

/** Pausa entre pedidos: o Plane aceita 60 por minuto por token. */
const PAUSE_MS = 1_100;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * O backup do Plane: um JSON com o espaço de trabalho tal como a API pública o mostra — os
 * membros e, por projeto, os estados, as etiquetas, os ciclos, os módulos e as tarefas (com a
 * descrição, o estado, a prioridade, as pessoas, as etiquetas, a tarefa-mãe e as datas). Os
 * comentários, os anexos, as páginas e o histórico ficam de fora: pedir os comentários tarefa
 * a tarefa passava o limite de 60 pedidos por minuto. Os pedidos vão espaçados, por isso um
 * espaço com muitos projetos demora uns minutos.
 */
export async function planeBackup(
  account: ConnectedAccount,
): Promise<BackupFile> {
  if (!account.baseUrl || !account.accessToken || !account.username) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O Plane já não tem token. Liga-o outra vez em Apps ligadas.',
    );
  }
  const client = createPlaneClient(
    account.baseUrl,
    account.accessToken,
    account.username,
  );
  const missing: string[] = [];
  const read = async <T>(key: string, work: () => Promise<T>) => {
    await pause(PAUSE_MS);
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

  const version = await planeVersion(account.baseUrl).catch(() => null);
  const projects = await client.projects();
  const members = await read('members', client.members);
  const exported: Record<string, unknown>[] = [];
  for (const project of projects) {
    const key = project.identifier;
    exported.push({
      ...project,
      states: await read(`${key}.states`, () => client.states(project.id)),
      labels: await read(`${key}.labels`, () => client.labels(project.id)),
      cycles: await read(`${key}.cycles`, () => client.cycles(project.id)),
      modules: await read(`${key}.modules`, () => client.modules(project.id)),
      workItems: await read(`${key}.workItems`, () =>
        client.workItems(project.id, 10_000),
      ),
    });
  }

  const content = Buffer.from(
    JSON.stringify(
      {
        format: 'myhomelab-backup',
        formatVersion: 1,
        app: 'plane',
        appVersion: version,
        service: account.displayName ?? 'Plane',
        address: account.baseUrl,
        workspace: account.username,
        createdAt: new Date().toISOString(),
        missing,
        data: { members, projects: exported },
      },
      null,
      2,
    ),
  );
  return { content, sizeBytes: content.length, missing };
}
