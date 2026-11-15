import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { createAdguardClient } from 'src/adguard/adguard.client';
import { BackupFile } from './backupSources';

/**
 * O que se lê do AdGuard para o backup: as definições que a API de controlo
 * mostra e que a mesma API deixa voltar a pôr. Os certificados TLS, a password
 * do painel, as estatísticas e o histórico de pedidos ficam de fora.
 * Algumas leituras só existem em versões mais novas (ou antigas); as que
 * falharem ficam listadas em `missing` em vez de estragar o backup.
 */
const SECTIONS: { key: string; paths: string[] }[] = [
  { key: 'dns', paths: ['/dns_info'] },
  { key: 'filtering', paths: ['/filtering/status'] },
  { key: 'rewrites', paths: ['/rewrite/list'] },
  { key: 'clients', paths: ['/clients'] },
  { key: 'access', paths: ['/access/list'] },
  {
    key: 'blockedServices',
    paths: ['/blocked_services/get', '/blocked_services/list'],
  },
  { key: 'safeBrowsing', paths: ['/safebrowsing/status'] },
  { key: 'parental', paths: ['/parental/status'] },
  { key: 'safeSearch', paths: ['/safesearch/status'] },
  { key: 'queryLog', paths: ['/querylog/config', '/querylog_info'] },
  { key: 'stats', paths: ['/stats/config', '/stats_info'] },
  { key: 'dhcp', paths: ['/dhcp/status'] },
];

/** Lê as definições do AdGuard e devolve o ficheiro do backup (JSON). */
export async function adguardBackup(
  account: ConnectedAccount,
): Promise<BackupFile> {
  if (!account.baseUrl || !account.username || !account.appPassword) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O AdGuard já não tem a password guardada. Liga-o outra vez em Apps ligadas.',
    );
  }
  const client = createAdguardClient(
    account.baseUrl,
    account.username,
    account.appPassword,
  );
  const status = await client.status();

  const data: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const section of SECTIONS) {
    let value: unknown = undefined;
    for (const path of section.paths) {
      try {
        value = await client.read<unknown>(path);
        break;
      } catch (error) {
        if (
          error instanceof AppIntegrationError &&
          error.code === 'APP_AUTH_FAILED'
        ) {
          throw error;
        }
      }
    }
    if (value === undefined) missing.push(section.key);
    else data[section.key] = value;
  }

  const content = Buffer.from(
    JSON.stringify(
      {
        format: 'myhomelab-backup',
        formatVersion: 1,
        app: 'adguard-home',
        appVersion: status.version,
        service: account.displayName ?? 'AdGuard',
        address: account.baseUrl,
        createdAt: new Date().toISOString(),
        missing,
        data,
      },
      null,
      2,
    ),
  );
  return { content, sizeBytes: content.length, missing };
}
