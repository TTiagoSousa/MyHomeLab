import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { CreateGameTrackerAccountDto } from '../dto/create-gametracker-account.dto';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  createGameTrackerClient,
  gameTrackerHealth,
  normalizeGameTrackerUrl,
} from 'src/gametracker/gametracker.client';

/**
 * Liga um GamesTracker com um token pessoal (gtv_): confirma que é um GamesTracker
 * (/api/health) e que o token entra (/api/auth/me), e guarda-o cifrado. O mesmo
 * utilizador já ligado neste endereço fica com o token novo.
 */
export async function createGameTrackerAccount(
  dto: CreateGameTrackerAccountDto,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const baseUrl = normalizeGameTrackerUrl(dto.baseUrl);
  const token = dto.token.trim();
  let me: Awaited<ReturnType<ReturnType<typeof createGameTrackerClient>['me']>>;
  try {
    await gameTrackerHealth(baseUrl);
    me = await createGameTrackerClient(baseUrl, token).me();
  } catch (error) {
    throw new BadRequestException(
      `Não foi possível ligar ao GamesTracker: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const existing = (
    await repository.findAllByUser(userId, ConnectionProvider.GAMETRACKER)
  ).find(
    (account) => account.baseUrl === baseUrl && account.username === me.id,
  );
  if (existing) {
    return repository.update(existing.id, {
      accessToken: token,
      isAdmin: me.isAdmin,
      isActive: true,
      ...(dto.displayName?.trim()
        ? { displayName: dto.displayName.trim() }
        : {}),
    });
  }

  return repository.create({
    userId,
    provider: ConnectionProvider.GAMETRACKER,
    displayName: dto.displayName?.trim() || me.username || undefined,
    accessToken: token,
    baseUrl,
    // O id do utilizador (estável); o nome mostra-se no displayName.
    username: me.id,
    isAdmin: me.isAdmin,
  });
}
