import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import {
  GoogleAccessRevokedError,
  refreshGoogleAccessToken,
} from '../google/google-oauth.client';
import {
  AppIntegrationError,
  toHttpError,
} from 'src/integrations/app-integration.error';

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

  let refreshed: Awaited<ReturnType<typeof refreshGoogleAccessToken>>;
  try {
    refreshed = await refreshGoogleAccessToken(account.refreshToken);
  } catch (error) {
    if (!(error instanceof GoogleAccessRevokedError)) throw error;
    await repository.markNeedsReconnect(account, error.message);
    throw toHttpError(
      new AppIntegrationError('APP_AUTH_FAILED', error.message),
    );
  }

  await repository.update(accountId, {
    accessToken: refreshed.access_token,
    tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
  });

  return refreshed.access_token;
}
