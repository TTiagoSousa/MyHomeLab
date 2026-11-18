import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { createStirlingClient } from 'src/stirling/stirling.client';
import { findConnectedAccount } from './findConnectedAccount';

/**
 * O estado do Stirling-PDF visto agora: a versão, quantas operações há (e quantas estão
 * desligadas), se a chave é de administrador (chega às definições) e se o MCP está ligado.
 */
export async function refreshStirlingAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.STIRLING_PDF) {
    throw new BadRequestException('Esta conta não é um Stirling-PDF');
  }
  if (!account.baseUrl || !account.accessToken) {
    throw new BadRequestException(
      'O Stirling-PDF já não tem chave. Liga-o outra vez com uma chave nova.',
    );
  }
  try {
    const client = createStirlingClient(account.baseUrl, account.accessToken);
    const [status, operations] = await Promise.all([
      client.status(),
      client.operations(),
    ]);
    const [disabled, isAdmin, mcp] = await Promise.all([
      client.disabledEndpoints().catch(() => null),
      client
        .settings('system')
        .then(() => true)
        .catch(() => false),
      client.mcpTools(),
    ]);
    const current =
      isAdmin !== account.isAdmin
        ? await repository.update(account.id, { isAdmin })
        : account;
    return {
      account: current,
      running: status.status === 'UP',
      operations: operations.length,
      disabled: disabled
        ? Object.values(disabled).filter((enabled) => enabled === false).length
        : null,
      isAdmin,
      mcpTools: mcp ? mcp.length : null,
    };
  } catch (error) {
    throw new BadRequestException(
      `O Stirling-PDF não respondeu: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
