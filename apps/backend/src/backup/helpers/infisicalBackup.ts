import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { createInfisicalClient } from 'src/infisical/infisical.client';
import { BackupFile } from './backupSources';

/**
 * O backup do Infisical: um JSON com todos os projetos que a Machine Identity vê e, por
 * ambiente, as pastas e os segredos COM OS VALORES em texto simples (as referências ${…}
 * ficam por resolver, como estão guardadas). O destino tem de ser privado. Os ambientes onde
 * a identidade não tem leitura ficam em `missing`. Não entram os segredos pessoais de cada
 * utilizador, as versões antigas, as integrações nem a configuração da instância.
 */
export async function infisicalBackup(
  account: ConnectedAccount,
): Promise<BackupFile> {
  if (!account.baseUrl || !account.apiClientId || !account.apiClientSecret) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O Infisical já não tem a Machine Identity. Liga-o outra vez em Apps ligadas.',
    );
  }
  const client = createInfisicalClient(
    account.baseUrl,
    account.apiClientId,
    account.apiClientSecret,
  );
  const projects = await client.projects();
  const missing: string[] = [];
  const data: unknown[] = [];
  for (const project of projects) {
    const environments: unknown[] = [];
    for (const env of project.environments) {
      const place = {
        projectId: project.id,
        environment: env.slug,
        secretPath: '/',
      };
      try {
        const [folders, { secrets, imports }] = await Promise.all([
          client.folders(place, { recursive: true }),
          client.secrets(place, { recursive: true, values: true }),
        ]);
        environments.push({
          slug: env.slug,
          name: env.name,
          folders: folders.map((folder) => ({
            name: folder.name,
            path: folder.relativePath ?? folder.path ?? folder.name,
            description: folder.description ?? null,
          })),
          secrets: secrets
            .filter((secret) => secret.type !== 'personal')
            .map((secret) => ({
              key: secret.secretKey,
              value: secret.secretValueHidden
                ? null
                : (secret.secretValue ?? ''),
              comment: secret.secretComment ?? '',
              path: secret.secretPath ?? '/',
              version: secret.version ?? null,
              tags: (secret.tags ?? []).map((tag) => tag.slug ?? tag.name),
            })),
          imports: imports.map((item) => ({
            environment: item.environment,
            path: item.secretPath,
          })),
        });
        if (secrets.some((secret) => secret.secretValueHidden)) {
          missing.push(`${project.name}/${env.slug} (valores escondidos)`);
        }
      } catch {
        missing.push(`${project.name}/${env.slug}`);
      }
    }
    data.push({
      id: project.id,
      name: project.name,
      slug: project.slug ?? null,
      description: project.description ?? null,
      environments,
    });
  }
  const content = Buffer.from(
    JSON.stringify(
      {
        format: 'myhomelab-backup',
        formatVersion: 1,
        app: 'infisical',
        service: account.displayName ?? 'Infisical',
        address: account.baseUrl,
        createdAt: new Date().toISOString(),
        warning:
          'Este ficheiro tem os segredos em texto simples. Guarda-o só num destino privado.',
        missing,
        data: { projects: data },
      },
      null,
      2,
    ),
  );
  return { content, sizeBytes: content.length, missing };
}
