import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import {
  exchangeGoogleCode,
  fetchGoogleEmailAddress,
  GoogleConnectionKind,
  googleKind,
} from '../google/google-oauth.client';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { GOOGLE_OAUTH_STATE_AUDIENCE } from 'src/auth/token-audience';

const PROVIDERS: Record<GoogleConnectionKind, ConnectionProvider> = {
  gmail: ConnectionProvider.GMAIL,
  tasks: ConnectionProvider.GOOGLE_TASKS,
  drive: ConnectionProvider.GOOGLE_DRIVE,
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
    // Só um state emitido pelo buildGoogleAuthUrl: um cookie de sessão não serve.
    const payload = stateJwt.verify<{
      userId?: unknown;
      kind?: GoogleConnectionKind;
    }>(state, { audience: GOOGLE_OAUTH_STATE_AUDIENCE });
    if (typeof payload.userId !== 'string' || !payload.userId) {
      throw new Error('state sem utilizador');
    }
    userId = payload.userId;
    kind = googleKind(payload.kind);
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
