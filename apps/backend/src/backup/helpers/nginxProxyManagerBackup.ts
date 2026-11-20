import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import {
  createNginxProxyManagerClient,
  nginxProxyManagerHealth,
} from 'src/nginx-proxy-manager/nginx-proxy-manager.client';
import { BackupFile } from './backupSources';

/** Dentro do meta dos certificados: o que é chave, certificado ou credencial de DNS. */
const CERTIFICATE_SECRET =
  /(certificate|key|credentials|intermediate|token|secret|password)/i;

/**
 * O backup do Nginx Proxy Manager: um JSON com o que a API mostra e deixa voltar a criar — os
 * proxy hosts, os redirecionamentos, os hosts 404, os streams, as listas de acesso (com os
 * utilizadores e os IPs, sem as passwords), as definições e os certificados só como metadados
 * (domínios, emissor, validade; sem chaves privadas nem credenciais de DNS). Os certificados
 * Let's Encrypt voltam a pedir-se; os carregados à mão guardam-se à parte. O que falhar ler
 * fica em `missing`.
 */
export async function nginxProxyManagerBackup(
  account: ConnectedAccount,
): Promise<BackupFile> {
  if (!account.baseUrl || !account.username || !account.appPassword) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O Nginx Proxy Manager já não tem a password guardada. Liga-o outra vez em Apps ligadas.',
    );
  }
  const client = createNginxProxyManagerClient(
    account.baseUrl,
    account.username,
    account.appPassword,
  );
  const health = await nginxProxyManagerHealth(account.baseUrl);
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

  const proxyHosts = await read('proxyHosts', () => client.proxyHosts());
  const redirectionHosts = await read('redirectionHosts', () =>
    client.redirectionHosts(),
  );
  const deadHosts = await read('deadHosts', () => client.deadHosts());
  const streams = await read('streams', () => client.streams());
  const accessLists = await read('accessLists', async () =>
    (await client.accessLists()).map((list) => ({
      ...list,
      items: (list.items ?? []).map((item) => ({
        username: item.username,
        hint: item.hint,
      })),
    })),
  );
  const certificates = await read('certificates', async () =>
    (await client.certificates()).map((certificate) => ({
      id: certificate.id,
      provider: certificate.provider,
      nice_name: certificate.nice_name,
      domain_names: certificate.domain_names,
      expires_on: certificate.expires_on,
      created_on: certificate.created_on,
      meta: Object.fromEntries(
        Object.entries(certificate.meta ?? {}).filter(
          ([key]) => !CERTIFICATE_SECRET.test(key),
        ),
      ),
    })),
  );
  const settings = await read('settings', () => client.settings());

  const strip = (items: object[] | null) =>
    items?.map((item) => {
      const copy = { ...item } as Record<string, unknown>;
      delete copy.certificate;
      delete copy.access_list;
      return copy;
    }) ?? null;

  const version = health.version
    ? `v${health.version.major}.${health.version.minor}.${health.version.revision}`
    : null;
  const content = Buffer.from(
    JSON.stringify(
      {
        format: 'myhomelab-backup',
        formatVersion: 1,
        app: 'nginx-proxy-manager',
        appVersion: version,
        service: account.displayName ?? 'Nginx Proxy Manager',
        address: account.baseUrl,
        createdAt: new Date().toISOString(),
        missing,
        data: {
          proxyHosts: strip(proxyHosts),
          redirectionHosts: strip(redirectionHosts),
          deadHosts,
          streams,
          accessLists,
          certificates,
          settings,
        },
      },
      null,
      2,
    ),
  );
  return { content, sizeBytes: content.length, missing };
}
