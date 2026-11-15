import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { createAdguardClient } from 'src/adguard/adguard.client';
import { findConnectedAccount } from './findConnectedAccount';

/** A conta AdGuard do utilizador e o cliente da API dela (sem password guardada → 400). */
export async function adguardClientFor(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.ADGUARD) {
    throw new BadRequestException('Esta conta não é um AdGuard');
  }
  if (!account.baseUrl || !account.username || !account.appPassword) {
    throw new BadRequestException(
      'O AdGuard já não tem a password guardada. Liga-o outra vez.',
    );
  }
  return {
    account,
    client: createAdguardClient(
      account.baseUrl,
      account.username,
      account.appPassword,
    ),
  };
}
