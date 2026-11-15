import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { findConnectedAccount } from './findConnectedAccount';

export async function deleteConnectedAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  await findConnectedAccount(id, userId, repository);
  await repository.disconnect(id);
}
