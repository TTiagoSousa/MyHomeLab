import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import {
  CoolifyKind,
  CoolifyProject,
  CoolifyResource,
  CoolifyServer,
  createCoolifyClient,
} from 'src/coolify/coolify.client';
import { BackupFile } from './backupSources';

/** Campos que podem levar segredos (passwords, tokens, chaves, URLs com credenciais). */
const SECRET_KEY =
  /(password|passwd|secret|token|private_key|api_key|_db_url|webhook|credentials)/i;

/** Tira os campos com segredos, a qualquer profundidade. */
export function scrubSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubSecrets);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !SECRET_KEY.test(key))
        .map(([key, item]) => [key, scrubSecrets(item)]),
    );
  }
  return value;
}

const KINDS: CoolifyKind[] = ['applications', 'services', 'databases'];

/**
 * O backup do Coolify: a API não faz um backup da instância (esse é o da base de dados dele,
 * em Settings → Backup), por isso fica um inventário em JSON para saber reconstruir tudo: os
 * servidores, os projetos com os ambientes, as aplicações, os serviços e as bases de dados com
 * a configuração (sem passwords nem tokens) e os NOMES das variáveis de ambiente (sem os
 * valores). O que falhar ler fica em `missing`.
 */
export async function coolifyBackup(
  account: ConnectedAccount,
): Promise<BackupFile> {
  if (!account.baseUrl || !account.accessToken) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O Coolify já não tem token. Liga-o outra vez em Apps ligadas.',
    );
  }
  const client = createCoolifyClient(account.baseUrl, account.accessToken);
  const version = await client.version();
  const missing: string[] = [];

  const servers = await client.servers().catch((): CoolifyServer[] => {
    missing.push('servers');
    return [];
  });
  const projects = await Promise.all(
    (
      await client.projects().catch((): CoolifyProject[] => {
        missing.push('projects');
        return [];
      })
    ).map((project) =>
      client.project(project.uuid).catch(() => {
        missing.push(`project:${project.name}`);
        return project;
      }),
    ),
  );

  const resources: Record<string, unknown[]> = {};
  for (const kind of KINDS) {
    const list = await client.list(kind).catch((): CoolifyResource[] => {
      missing.push(kind);
      return [];
    });
    resources[kind] = [];
    for (const item of list) {
      const full = await client.get(kind, item.uuid).catch(() => item);
      const envs = await client
        .envs(kind, item.uuid)
        .then((items) =>
          items.map((env) => ({
            key: env.key,
            is_preview: env.is_preview ?? false,
            is_buildtime: env.is_buildtime ?? null,
            is_runtime: env.is_runtime ?? null,
            is_literal: env.is_literal ?? null,
          })),
        )
        .catch(() => {
          missing.push(`envs:${item.name}`);
          return null;
        });
      resources[kind].push({ ...(scrubSecrets(full) as object), envs });
    }
  }

  const content = Buffer.from(
    JSON.stringify(
      {
        format: 'myhomelab-backup',
        formatVersion: 1,
        app: 'coolify',
        appVersion: version,
        service: account.displayName ?? 'Coolify',
        address: account.baseUrl,
        createdAt: new Date().toISOString(),
        missing,
        data: {
          servers: scrubSecrets(servers),
          projects: scrubSecrets(projects),
          ...resources,
        },
      },
      null,
      2,
    ),
  );
  return { content, sizeBytes: content.length, missing };
}
