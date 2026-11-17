import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { CreateImmichAccountDto } from '../dto/create-immich-account.dto';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  createImmichClient,
  ImmichMe,
  immichVersion,
  normalizeImmichUrl,
} from 'src/immich/immich.client';

/**
 * Liga um Immich com uma chave de API: confirma que é um Immich (/api/server/version)
 * e que a chave entra (/api/users/me), e guarda-a cifrada. O mesmo utilizador já ligado
 * neste endereço fica com a chave nova.
 */
export async function createImmichAccount(
  dto: CreateImmichAccountDto,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const baseUrl = normalizeImmichUrl(dto.baseUrl);
  const apiKey = dto.apiKey.trim();
  let me: ImmichMe;
  try {
    await immichVersion(baseUrl);
    me = await createImmichClient(baseUrl, apiKey).me();
  } catch (error) {
    throw new BadRequestException(
      `Não foi possível ligar ao Immich: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const existing = (
    await repository.findAllByUser(userId, ConnectionProvider.IMMICH)
  ).find(
    (account) => account.baseUrl === baseUrl && account.username === me.id,
  );
  if (existing) {
    return repository.update(existing.id, {
      accessToken: apiKey,
      isAdmin: me.isAdmin,
      isActive: true,
      ...(dto.displayName?.trim()
        ? { displayName: dto.displayName.trim() }
        : {}),
    });
  }

  return repository.create({
    userId,
    provider: ConnectionProvider.IMMICH,
    displayName: dto.displayName?.trim() || me.name || undefined,
    accessToken: apiKey,
    baseUrl,
    // O id do utilizador (estável); o nome mostra-se no displayName.
    username: me.id,
    isAdmin: me.isAdmin,
  });
}
