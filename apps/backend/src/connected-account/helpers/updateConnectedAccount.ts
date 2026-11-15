import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { UpdateConnectedAccountDto } from '../dto/update-connected-account.dto';
import { findConnectedAccount } from './findConnectedAccount';
import { assertOwnServer } from './assertOwnServer';

export async function updateConnectedAccount(
  id: string,
  userId: string,
  dto: UpdateConnectedAccountDto,
  repository: PrismaConnectedAccountRepository,
) {
  await findConnectedAccount(id, userId, repository);
  await assertOwnServer(userId, dto.serverConnectionId, repository);
  return repository.update(id, dto);
}
