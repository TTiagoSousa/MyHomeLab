import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { createCoolifyClient } from 'src/coolify/coolify.client';
import { findConnectedAccount } from './findConnectedAccount';

const healthy = (status?: string) =>
  !status || /^running(:healthy|:unknown)?$/i.test(status);

/** O Coolify visto agora: a equipa, os servidores, os recursos, os que não estão bem e o MCP. */
export async function refreshCoolifyAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.COOLIFY) {
    throw new BadRequestException('Esta conta não é um Coolify');
  }
  if (!account.baseUrl || !account.accessToken) {
    throw new BadRequestException(
      'O Coolify já não tem token. Liga-o outra vez com um token novo.',
    );
  }
  try {
    const client = createCoolifyClient(account.baseUrl, account.accessToken);
    const [team, servers, projects, resources, mcp] = await Promise.all([
      client
        .currentTeam()
        .then((body) => body.name)
        .catch(() => account.username ?? null),
      client.servers(),
      client.projects(),
      client.resources(),
      client.mcpTools(),
    ]);
    const counts = { applications: 0, services: 0, databases: 0 };
    for (const item of resources) {
      const type = item.type ?? '';
      if (type === 'application') counts.applications += 1;
      else if (type === 'service') counts.services += 1;
      else counts.databases += 1;
    }
    return {
      account,
      team,
      servers: servers.length,
      unreachable: servers
        .filter(
          (server) =>
            (server.is_reachable ?? server.settings?.is_reachable) === false,
        )
        .map((server) => server.name),
      projects: projects.length,
      resources: counts,
      unhealthy: resources
        .filter((item) => !healthy(item.status))
        .slice(0, 10)
        .map((item) => ({ name: item.name, status: item.status ?? '' })),
      mcp: mcp ? mcp.length : null,
    };
  } catch (error) {
    throw new BadRequestException(
      `O Coolify não respondeu: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
