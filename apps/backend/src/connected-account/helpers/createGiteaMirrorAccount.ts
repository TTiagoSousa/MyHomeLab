import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { CreateGiteaMirrorAccountDto } from '../dto/create-gitea-mirror-account.dto';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  createGiteaMirrorClient,
  giteaMirrorHealth,
  normalizeGiteaMirrorUrl,
} from 'src/gitea-mirror/gitea-mirror.client';

/**
 * Liga um Gitea Mirror com a chave de API: confirma que é um Gitea Mirror (/api/health) e que
 * a chave entra (os repositórios; um 404 quer dizer só que ainda não está configurado). Guarda a
 * chave cifrada. O mesmo endereço já ligado fica com a chave nova.
 */
export async function createGiteaMirrorAccount(
  dto: CreateGiteaMirrorAccountDto,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const baseUrl = normalizeGiteaMirrorUrl(dto.baseUrl);
  const apiKey = dto.apiKey.trim();
  try {
    const health = await giteaMirrorHealth(baseUrl);
    if (!health.status) {
      throw new Error('este endereço não é um Gitea Mirror (não diz o estado)');
    }
    await createGiteaMirrorClient(baseUrl, apiKey)
      .repositories()
      .catch((error: unknown) => {
        if (error instanceof Error && / 404 /.test(error.message)) return [];
        throw error;
      });
  } catch (error) {
    throw new BadRequestException(
      `Não foi possível ligar ao Gitea Mirror: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const existing = (
    await repository.findAllByUser(userId, ConnectionProvider.GITEA_MIRROR)
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
    provider: ConnectionProvider.GITEA_MIRROR,
    displayName: dto.displayName?.trim() || 'Gitea Mirror',
    accessToken: apiKey,
    baseUrl,
  });
}
