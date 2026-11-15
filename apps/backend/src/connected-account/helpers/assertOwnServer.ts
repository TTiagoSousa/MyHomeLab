import { NotFoundException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';

/** O servidor escolhido para uma app tem de ser do utilizador. */
export async function assertOwnServer(
  userId: string,
  serverConnectionId: string | null | undefined,
  repository: PrismaConnectedAccountRepository,
) {
  if (
    serverConnectionId &&
    !(await repository.ownsServer(userId, serverConnectionId))
  ) {
    throw new NotFoundException('Esse servidor já não existe.');
  }
}
