import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  createVaultwardenClient,
  databaseKind,
  vaultwardenOrganizations,
} from 'src/vaultwarden/vaultwarden.client';
import { findConnectedAccount } from './findConnectedAccount';

/** O Vaultwarden visto agora: os utilizadores (ativos, convidados, desativados, sem 2FA), as organizações e o essencial da configuração. */
export async function refreshVaultwardenAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.VAULTWARDEN) {
    throw new BadRequestException('Esta conta não é um Vaultwarden');
  }
  if (!account.baseUrl || !account.accessToken) {
    throw new BadRequestException(
      'O Vaultwarden já não tem o token de administração. Liga-o outra vez.',
    );
  }
  try {
    const client = createVaultwardenClient(
      account.baseUrl,
      account.accessToken,
    );
    const [users, config] = await Promise.all([
      client.users(),
      client.config().catch(() => null),
    ]);
    const invited = users.filter((user) => user._status === 1);
    const active = users.filter((user) => user._status !== 1);
    return {
      account,
      users: active.length,
      invited: invited.length,
      disabled: users.filter((user) => user.userEnabled === false).length,
      withoutTwoFactor: active.filter((user) => !user.twoFactorEnabled).length,
      organizations: vaultwardenOrganizations(users).length,
      signupsAllowed:
        typeof config?.signups_allowed === 'boolean'
          ? config.signups_allowed
          : null,
      database: config ? databaseKind(config.database_url) : null,
    };
  } catch (error) {
    throw new BadRequestException(
      `O Vaultwarden não respondeu: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
