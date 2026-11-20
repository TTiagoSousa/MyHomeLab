import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  createJellyfinClient,
  JellyfinSession,
  JellyfinUser,
} from 'src/jellyfin/jellyfin.client';
import { findConnectedAccount } from './findConnectedAccount';

/** O Jellyfin visto agora: o servidor, as bibliotecas, as contagens e quem está a ver. */
export async function refreshJellyfinAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.JELLYFIN) {
    throw new BadRequestException('Esta conta não é um Jellyfin');
  }
  if (!account.baseUrl || !account.accessToken) {
    throw new BadRequestException(
      'O Jellyfin já não tem chave. Liga-o outra vez com uma chave nova.',
    );
  }
  try {
    const client = createJellyfinClient(account.baseUrl, account.accessToken);
    const [info, libraries, counts, sessions, users] = await Promise.all([
      client.info(),
      client.libraries(),
      client.counts().catch(() => null),
      client.sessions(300).catch((): JellyfinSession[] => []),
      client.users().catch((): JellyfinUser[] => []),
    ]);
    return {
      account,
      server: info.ServerName ?? null,
      operatingSystem: info.OperatingSystemDisplayName ?? null,
      pendingRestart: Boolean(info.HasPendingRestart),
      libraries: libraries.map((library) => ({
        id: library.ItemId,
        name: library.Name,
        type: library.CollectionType ?? null,
      })),
      counts: {
        movies: counts?.MovieCount ?? 0,
        series: counts?.SeriesCount ?? 0,
        episodes: counts?.EpisodeCount ?? 0,
        albums: counts?.AlbumCount ?? 0,
        songs: counts?.SongCount ?? 0,
      },
      users: users.length,
      playing: sessions.filter((session) => session.NowPlayingItem).length,
    };
  } catch (error) {
    throw new BadRequestException(
      `O Jellyfin não respondeu: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
