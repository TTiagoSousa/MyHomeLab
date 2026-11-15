import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { createForgejoClient } from 'src/forgejo/forgejo.client';
import { findConnectedAccount } from './findConnectedAccount';

/**
 * O estado da conta Forgejo, visto agora: se o token ainda vale, se é de um
 * administrador (o que decide se o backup leva a instância toda) e quantos
 * repositórios entram no backup. Guarda o "é admin" para a lista de contas.
 */
export async function refreshForgejoAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.FORGEJO) {
    throw new BadRequestException('Esta conta não é uma conta Forgejo');
  }
  if (!account.baseUrl || !account.accessToken) {
    throw new BadRequestException(
      'A conta Forgejo já não tem token. Liga-a outra vez.',
    );
  }
  const client = createForgejoClient({
    baseUrl: account.baseUrl,
    token: account.accessToken,
  });
  try {
    const user = await client.me();
    const repos = await client.allRepos(user.is_admin);
    const current =
      user.is_admin !== account.isAdmin
        ? await repository.update(account.id, { isAdmin: user.is_admin })
        : account;
    return {
      account: current,
      login: user.login,
      isAdmin: user.is_admin,
      repositories: repos.length,
      privateRepositories: repos.filter((repo) => repo.private).length,
    };
  } catch (error) {
    throw new BadRequestException(
      `O Forgejo não respondeu: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
