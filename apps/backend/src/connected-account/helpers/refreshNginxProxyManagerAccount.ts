import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  createNginxProxyManagerClient,
  NginxCertificate,
  NginxDeadHost,
  NginxRedirectionHost,
  NginxStream,
} from 'src/nginx-proxy-manager/nginx-proxy-manager.client';
import { daysLeft } from 'src/assistant/toolsets/nginx-proxy-manager-tools';
import { findConnectedAccount } from './findConnectedAccount';

/**
 * O Nginx Proxy Manager visto agora: o utilizador, quantos hosts de cada tipo, os desligados e
 * os com erro no nginx, e os certificados que expiram nos próximos 30 dias.
 */
export async function refreshNginxProxyManagerAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.NGINX_PROXY_MANAGER) {
    throw new BadRequestException('Esta conta não é um Nginx Proxy Manager');
  }
  if (!account.baseUrl || !account.username || !account.appPassword) {
    throw new BadRequestException(
      'O Nginx Proxy Manager já não tem a password guardada. Liga-o outra vez.',
    );
  }
  try {
    const client = createNginxProxyManagerClient(
      account.baseUrl,
      account.username,
      account.appPassword,
    );
    const [user, proxies, redirections, dead, streams, certificates] =
      await Promise.all([
        client.me(),
        client.proxyHosts(),
        client.redirectionHosts().catch((): NginxRedirectionHost[] => []),
        client.deadHosts().catch((): NginxDeadHost[] => []),
        client.streams().catch((): NginxStream[] => []),
        client.certificates().catch((): NginxCertificate[] => []),
      ]);
    const all = [...proxies, ...redirections, ...dead, ...streams];
    return {
      account,
      profile: user.name || user.email,
      proxyHosts: proxies.length,
      redirectionHosts: redirections.length,
      deadHosts: dead.length,
      streams: streams.length,
      disabled: all.filter((item) => !item.enabled).length,
      offline: all.filter((item) => item.meta?.nginx_online === false).length,
      certificates: certificates.length,
      expiringSoon: certificates
        .map((item) => ({ item, days: daysLeft(item) }))
        .filter((entry) => entry.days !== null && entry.days <= 30)
        .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))
        .map(({ item, days }) => ({
          name: item.nice_name || item.domain_names.join(', '),
          expiresOn: item.expires_on ?? null,
          days: days ?? 0,
        })),
    };
  } catch (error) {
    throw new BadRequestException(
      `O Nginx Proxy Manager não respondeu: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
