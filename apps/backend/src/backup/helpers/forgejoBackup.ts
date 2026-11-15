import { createReadStream, createWriteStream } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { ReadableStream as WebReadableStream } from 'stream/web';
import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { ForgejoError, createForgejoClient } from 'src/forgejo/forgejo.client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { BackupFile } from './backupSources';
import { clearForgejoArchives } from './clearForgejoArchives';
import { TarEntry, writeTar } from './writeTar';

/**
 * O backup do Forgejo: um .tar com, por repositório, o código inteiro do ramo
 * principal em git bundle (`git clone repo.bundle` recupera-o com o histórico) e um
 * JSON com as issues, os pull requests, os comentários, as etiquetas, as milestones
 * e as releases. Com uma conta de administrador entram os repositórios da
 * instância toda; senão, os do dono do token.
 *
 * Não leva os utilizadores nem as definições do Forgejo: isso só o `forgejo dump`,
 * na própria máquina. Com admin, limpa a cache dos arquivos do Forgejo (repo-archive)
 * antes, para não haver registos de arquivos já apagados, e no fim, para não lhe
 * encher o disco. Um bundle que falhe tenta-se outra vez uma vez.
 */
export async function forgejoBackup(
  account: ConnectedAccount,
): Promise<BackupFile> {
  if (!account.baseUrl || !account.accessToken) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'A conta Forgejo já não tem token. Liga-a outra vez em Apps ligadas.',
    );
  }
  const client = createForgejoClient({
    baseUrl: account.baseUrl,
    token: account.accessToken,
  });
  const folder = await mkdtemp(join(tmpdir(), 'myhomelab-forgejo-'));
  const cleanup = () => rm(folder, { recursive: true, force: true });

  try {
    // Visto agora, e não o guardado: a conta pode ter passado a admin (ou deixado).
    const { is_admin: admin } = await client.me();
    const repos = await client.allRepos(admin);
    if (admin) await clearForgejoArchives(client);
    const entries: TarEntry[] = [];
    const missing: string[] = [];

    for (const [index, repo] of repos.entries()) {
      if (!repo.empty) {
        const file = join(folder, `${index}.bundle`);
        const save = async () => {
          const body = await client.bundle(repo.full_name, repo.default_branch);
          await pipeline(
            Readable.fromWeb(body as WebReadableStream),
            createWriteStream(file),
          );
        };
        try {
          // A segunda vez o Forgejo já gera o arquivo de novo (ex.: o da cache sumiu).
          await save().catch(save);
          entries.push({ name: `${repo.full_name}.bundle`, content: { file } });
        } catch {
          missing.push(`${repo.full_name} (código)`);
        }
      }

      // Um repositório com as issues (ou as releases) desligadas responde 404: não há
      // nada a guardar dessa parte. Outro erro fica registado como em falta.
      const part = async (name: string, read: () => Promise<unknown[]>) => {
        try {
          return await read();
        } catch (error) {
          if (!(error instanceof ForgejoError && error.status === 404)) {
            missing.push(`${repo.full_name} (${name})`);
          }
          return [];
        }
      };
      const [issues, comments, labels, milestones, releases] =
        await Promise.all([
          part('issues', () => client.allIssues(repo.full_name)),
          part('comentários', () => client.allComments(repo.full_name)),
          part('etiquetas', () => client.allLabels(repo.full_name)),
          part('milestones', () => client.allMilestones(repo.full_name)),
          part('releases', () => client.allReleases(repo.full_name)),
        ]);
      entries.push({
        name: `${repo.full_name}.json`,
        content: Buffer.from(
          JSON.stringify(
            {
              repository: repo,
              issues,
              comments,
              labels,
              milestones,
              releases,
            },
            null,
            2,
          ),
        ),
      });
    }

    entries.unshift({
      name: 'forgejo.json',
      content: Buffer.from(
        JSON.stringify(
          {
            instance: account.baseUrl,
            user: account.username,
            admin,
            createdAt: new Date().toISOString(),
            repositories: repos.map((repo) => repo.full_name),
          },
          null,
          2,
        ),
      ),
    });

    // Os bundles pedidos ficaram em cache na máquina do Forgejo (repo-archive) e enchem o
    // disco até à limpeza da meia-noite; com admin, limpa-se já. Se falhar, o backup vale na mesma.
    if (admin) await clearForgejoArchives(client);

    const tarPath = join(folder, 'forgejo.tar');
    const sizeBytes = await writeTar(tarPath, entries);
    return { content: createReadStream(tarPath), sizeBytes, missing, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
