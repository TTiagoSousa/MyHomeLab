import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { findConnectedAccount } from './findConnectedAccount';
import { ensureFreshAccessToken } from './ensureFreshAccessToken';
import { getMailboxStats } from 'src/email-rule/google/gmail-api.client';
import { ConnectionProvider } from 'src/generated/prisma/client/client';

export async function getGmailStats(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);

  if (account.provider !== ConnectionProvider.GMAIL) {
    throw new BadRequestException('Esta conta não é uma conta Google');
  }

  const accessToken = await ensureFreshAccessToken(id, repository);
  return getMailboxStats(accessToken);
}
