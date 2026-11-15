import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import {
  exchangeGoogleCode,
  fetchGoogleEmailAddress,
  GoogleConnectionKind,
} from '../google/google-oauth.client';
import { ConnectionProvider } from 'src/generated/prisma/client/client';

const PROVIDERS: Record<GoogleConnectionKind, ConnectionProvider> = {
  gmail: ConnectionProvider.GMAIL,
  tasks: ConnectionProvider.GOOGLE_TASKS,
};

export async function handleGoogleCallback(
  code: string,
  state: string,
  stateJwt: JwtService,
  repository: PrismaConnectedAccountRepository,
): Promise<GoogleConnectionKind> {
  let userId: string;
  let kind: GoogleConnectionKind;
  try {
    const payload = stateJwt.verify<{
      userId: string;
      kind?: GoogleConnectionKind;
    }>(state);
    userId = payload.userId;
    kind = payload.kind === 'tasks' ? 'tasks' : 'gmail';
  } catch {
    throw new BadRequestException('State inválido ou expirado');
  }
  const provider = PROVIDERS[kind];

  const tokens = await exchangeGoogleCode(code);
  const emailAddress = await fetchGoogleEmailAddress(tokens.access_token);
  const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const scopes = tokens.scope.split(' ');

  const existing = await repository.findByUserAndEmail(
    userId,
    emailAddress,
    provider,
  );

  // Religar um email que já esteve ligado revive a mesma linha — e com ela as regras
  // que lhe estavam penduradas — em vez de criar uma conta nova e vazia.
  if (existing) {
    await repository.update(existing.id, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? existing.refreshToken ?? undefined,
      tokenExpiresAt,
      scopes,
      isActive: true,
      disconnectedAt: null,
    });
    return kind;
  }

  await repository.create({
    userId,
    provider,
    emailAddress,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiresAt,
    scopes,
  });
  return kind;
}
