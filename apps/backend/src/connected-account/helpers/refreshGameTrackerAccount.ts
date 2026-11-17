import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { createGameTrackerClient } from 'src/gametracker/gametracker.client';
import { findConnectedAccount } from './findConnectedAccount';

/**
 * O estado do GamesTracker visto agora: o utilizador do token (e se é admin) e a
 * prateleira (quantos jogos em cada estante, horas e a média das notas).
 */
export async function refreshGameTrackerAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.GAMETRACKER) {
    throw new BadRequestException('Esta conta não é um GamesTracker');
  }
  if (!account.baseUrl || !account.accessToken) {
    throw new BadRequestException(
      'O GamesTracker já não tem token. Liga-o outra vez com um token novo.',
    );
  }
  try {
    const client = createGameTrackerClient(
      account.baseUrl,
      account.accessToken,
    );
    const [me, library, stats] = await Promise.all([
      client.me(),
      client.library(),
      client.stats(),
    ]);
    const current =
      me.isAdmin !== account.isAdmin
        ? await repository.update(account.id, { isAdmin: me.isAdmin })
        : account;
    const counts = library.counts;
    const hours = stats.hours as { total?: number } | undefined;
    const rating = stats.rating as { average?: number | null } | undefined;
    return {
      account: current,
      profile: me.username,
      isAdmin: me.isAdmin,
      total: library.total,
      playing: (counts.PLAYING ?? 0) + (counts.PAUSED ?? 0),
      finished:
        (counts.FINISHED_MAIN ?? 0) +
        (counts.FINISHED_EXTRAS ?? 0) +
        (counts.COMPLETED_100 ?? 0),
      planned: counts.PLAN_TO_PLAY ?? 0,
      hours: Math.round(hours?.total ?? 0),
      rating: rating?.average ?? null,
    };
  } catch (error) {
    throw new BadRequestException(
      `O GamesTracker não respondeu: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
