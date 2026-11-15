import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { CreateOpenGymAccountDto } from '../dto/create-opengym-account.dto';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  normalizeOpenGymUrl,
  openGymHealth,
  redeemOpenGymCode,
  tokenExpiry,
} from 'src/opengym/opengym.client';

/**
 * Liga um perfil openGym com o código de emparelhamento (o mesmo da app do
 * telemóvel): troca-o por um token e guarda-o cifrado. Um perfil já ligado neste
 * endereço fica com o token novo — é assim que se volta a ligar quando expira.
 */
export async function createOpenGymAccount(
  dto: CreateOpenGymAccountDto,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const baseUrl = normalizeOpenGymUrl(dto.baseUrl);
  let paired: Awaited<ReturnType<typeof redeemOpenGymCode>>;
  try {
    await openGymHealth(baseUrl);
    paired = await redeemOpenGymCode(baseUrl, dto.code);
  } catch (error) {
    throw new BadRequestException(
      `Não foi possível ligar ao openGym: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const existing = (
    await repository.findAllByUser(userId, ConnectionProvider.OPENGYM)
  ).find(
    (account) =>
      account.baseUrl === baseUrl && account.username === paired.user.id,
  );
  const tokenExpiresAt = tokenExpiry(paired.token) ?? undefined;
  if (existing) {
    return repository.update(existing.id, {
      accessToken: paired.token,
      ...(tokenExpiresAt ? { tokenExpiresAt } : {}),
      isAdmin: Boolean(paired.user.admin),
      isActive: true,
      ...(dto.displayName?.trim()
        ? { displayName: dto.displayName.trim() }
        : {}),
    });
  }

  return repository.create({
    userId,
    provider: ConnectionProvider.OPENGYM,
    displayName: dto.displayName?.trim() || paired.user.name || undefined,
    accessToken: paired.token,
    tokenExpiresAt,
    baseUrl,
    // O id do perfil (estável); o nome mostra-se no displayName.
    username: paired.user.id,
    isAdmin: Boolean(paired.user.admin),
  });
}
