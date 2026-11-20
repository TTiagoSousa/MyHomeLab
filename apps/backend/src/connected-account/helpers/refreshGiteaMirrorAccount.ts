import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  createGiteaMirrorClient,
  giteaMirrorHealth,
} from 'src/gitea-mirror/gitea-mirror.client';
import { findConnectedAccount } from './findConnectedAccount';

/** O Gitea Mirror visto agora: a saúde, os repositórios por estado, as falhas e o MCP. */
export async function refreshGiteaMirrorAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.GITEA_MIRROR) {
    throw new BadRequestException('Esta conta não é um Gitea Mirror');
  }
  if (!account.baseUrl || !account.accessToken) {
    throw new BadRequestException(
      'O Gitea Mirror já não tem chave. Liga-o outra vez com uma chave nova.',
    );
  }
  try {
    const client = createGiteaMirrorClient(
      account.baseUrl,
      account.accessToken,
    );
    const [health, repositories, mcp] = await Promise.all([
      giteaMirrorHealth(account.baseUrl),
      client.repositories(),
      client.mcpTools(),
    ]);
    const byStatus: Record<string, number> = {};
    for (const item of repositories) {
      byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
    }
    return {
      account,
      health: health.status,
      repositories: repositories.length,
      byStatus,
      failed: repositories
        .filter((item) => item.status === 'failed')
        .slice(0, 10)
        .map((item) => ({
          name: item.fullName,
          error: item.errorMessage ?? null,
        })),
      mcp: mcp ? mcp.length : null,
    };
  } catch (error) {
    throw new BadRequestException(
      `O Gitea Mirror não respondeu: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
