import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { toAccountView } from './toAccountView';

export async function listConnectedAccounts(
  userId: string,
  repository: PrismaConnectedAccountRepository,
  provider?: ConnectionProvider,
) {
  const accounts = await repository.findAllByUser(userId, provider);
  return accounts.map(toAccountView);
}
