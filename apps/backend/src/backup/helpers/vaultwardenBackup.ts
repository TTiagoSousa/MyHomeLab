import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import {
  createVaultwardenClient,
  redactVaultwardenConfig,
  sanitizeVaultwardenUser,
  vaultwardenOrganizations,
  vaultwardenVersion,
} from 'src/vaultwarden/vaultwarden.client';
import { BackupFile } from './backupSources';

/**
 * O backup do Vaultwarden pelo painel de administração: um JSON com a configuração em vigor
 * (os segredos escondidos), os utilizadores (sem as chaves cifradas) e as organizações.
 * Os cofres não entram: estão cifrados com a password mestra de cada um e a API do painel
 * não os exporta. Para os ter, faz backup da pasta data do Vaultwarden (ou do CT/VM).
 */
export async function vaultwardenBackup(
  account: ConnectedAccount,
): Promise<BackupFile> {
  if (!account.baseUrl || !account.accessToken) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O Vaultwarden já não tem o token de administração. Liga-o outra vez em Apps ligadas.',
    );
  }
  const client = createVaultwardenClient(account.baseUrl, account.accessToken);
  const users = await client.users();
  const missing: string[] = [];
  const version = await vaultwardenVersion(account.baseUrl).catch(() => null);
  const config = await client.config().catch(() => {
    missing.push('config');
    return null;
  });
  const content = Buffer.from(
    JSON.stringify(
      {
        format: 'myhomelab-backup',
        formatVersion: 1,
        app: 'vaultwarden',
        appVersion: version,
        service: account.displayName ?? 'Vaultwarden',
        address: account.baseUrl,
        createdAt: new Date().toISOString(),
        note: 'Sem os cofres: estão cifrados com a password mestra de cada utilizador e o painel de administração não os exporta.',
        missing,
        data: {
          config: config ? redactVaultwardenConfig(config) : null,
          users: users.map(sanitizeVaultwardenUser),
          organizations: vaultwardenOrganizations(users),
        },
      },
      null,
      2,
    ),
  );
  return { content, sizeBytes: content.length, missing };
}
