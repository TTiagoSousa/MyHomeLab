import { Logger } from '@nestjs/common';
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

/** Como acabou a ligação: o browser volta à página de origem com `?google=<error>` quando falha. */
export interface GoogleCallbackResult {
  kind: GoogleConnectionKind;
  error: 'cancelled' | 'failed' | null;
}

const logger = new Logger('GoogleCallback');

/**
 * O regresso do consentimento do Google. Carregar em "Cancelar" lá traz ?error=access_denied
 * e nenhum code: antes dava 500 em JSON; agora volta-se à página com a razão.
 */
export async function handleGoogleCallback(
  code: string | undefined,
  state: string | undefined,
  providerError: string | undefined,
  stateJwt: JwtService,
  repository: PrismaConnectedAccountRepository,
): Promise<GoogleCallbackResult> {
  let userId: string;
  let kind: GoogleConnectionKind;
  try {
    // Só um state emitido pelo buildGoogleAuthUrl: um cookie de sessão não serve.
    const payload = stateJwt.verify<{
      userId?: unknown;
      kind?: GoogleConnectionKind;
    }>(state ?? '', { audience: GOOGLE_OAUTH_STATE_AUDIENCE });
    if (typeof payload.userId !== 'string' || !payload.userId) {
      throw new Error('state sem utilizador');
    }
    userId = payload.userId;
    kind = googleKind(payload.kind);
  } catch {
    // Sem um state válido não se sabe de quem é: não se liga nada.
    return { kind: 'gmail', error: 'failed' };
  }
  if (providerError || !code) {
    return {
      kind,
      error:
        !providerError || providerError === 'access_denied'
          ? 'cancelled'
          : 'failed',
    };
  }
  try {
    await saveGoogleTokens(code, userId, kind, repository);
    return { kind, error: null };
  } catch (error) {
    logger.warn(
      `Falha ao ligar a conta Google (${kind}): ${error instanceof Error ? error.message : String(error)}`,
    );
    return { kind, error: 'failed' };
  }
}

async function saveGoogleTokens(
  code: string,
  userId: string,
  kind: GoogleConnectionKind,
  repository: PrismaConnectedAccountRepository,
): Promise<void> {
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
    await repository.resolveNeedsReconnect(existing);
    return;
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
}
