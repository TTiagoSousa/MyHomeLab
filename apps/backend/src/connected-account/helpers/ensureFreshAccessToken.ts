import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { refreshGoogleAccessToken } from '../google/google-oauth.client';

const REFRESH_BUFFER_MS = 2 * 60 * 1000;

export async function ensureFreshAccessToken(
  accountId: string,
  repository: PrismaConnectedAccountRepository,
): Promise<string> {
  const account = await repository.findById(accountId);
  if (!account) throw new NotFoundException('Conta não encontrada');

  const isExpiringSoon =
    !account.tokenExpiresAt ||
    account.tokenExpiresAt.getTime() - Date.now() < REFRESH_BUFFER_MS;

  if (!isExpiringSoon && account.accessToken) {
    return account.accessToken;
  }

  if (!account.refreshToken) {
    throw new BadRequestException(
      'Conta sem refresh token — liga a conta novamente',
    );
  }

  const refreshed = await refreshGoogleAccessToken(account.refreshToken);

  await repository.update(accountId, {
    accessToken: refreshed.access_token,
    tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
  });

  return refreshed.access_token;
}
