import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { CreateJellyfinAccountDto } from '../dto/create-jellyfin-account.dto';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  createJellyfinClient,
  JellyfinSystemInfo,
  jellyfinPublicInfo,
  normalizeJellyfinUrl,
} from 'src/jellyfin/jellyfin.client';

/**
 * Liga um Jellyfin com uma chave de API: confirma que é um Jellyfin (/System/Info/Public) e
 * que a chave entra (/System/Info, que só responde a quem administra). Guarda a chave cifrada
 * e, em displayName, o nome do servidor quando não se escolhe outro. O mesmo endereço já
 * ligado fica com a chave nova.
 */
export async function createJellyfinAccount(
  dto: CreateJellyfinAccountDto,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const baseUrl = normalizeJellyfinUrl(dto.baseUrl);
  const apiKey = dto.apiKey.trim();
  let info: JellyfinSystemInfo;
  try {
    await jellyfinPublicInfo(baseUrl);
    info = await createJellyfinClient(baseUrl, apiKey).info();
  } catch (error) {
    throw new BadRequestException(
      `Não foi possível ligar ao Jellyfin: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const existing = (
    await repository.findAllByUser(userId, ConnectionProvider.JELLYFIN)
  ).find((account) => account.baseUrl === baseUrl);
  if (existing) {
    return repository.update(existing.id, {
      accessToken: apiKey,
      isActive: true,
      ...(dto.displayName?.trim()
        ? { displayName: dto.displayName.trim() }
        : {}),
    });
  }
  return repository.create({
    userId,
    provider: ConnectionProvider.JELLYFIN,
    displayName: dto.displayName?.trim() || info.ServerName || 'Jellyfin',
    accessToken: apiKey,
    baseUrl,
    isAdmin: true,
  });
}
