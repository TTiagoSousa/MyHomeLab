import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { createDispatcharrClient } from 'src/dispatcharr/dispatcharr.client';
import { findConnectedAccount } from './findConnectedAccount';

/** O Dispatcharr visto agora: o utilizador da chave, os canais, as fontes e quem está a ver. */
export async function refreshDispatcharrAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.DISPATCHARR) {
    throw new BadRequestException('Esta conta não é um Dispatcharr');
  }
  if (!account.baseUrl || !account.accessToken) {
    throw new BadRequestException(
      'O Dispatcharr já não tem chave. Liga-o outra vez com uma chave nova.',
    );
  }
  try {
    const client = createDispatcharrClient(
      account.baseUrl,
      account.accessToken,
    );
    const [me, channels, streams, m3u, epg, stats] = await Promise.all([
      client.me(),
      client.channels({ limit: 1 }),
      client.streams({ limit: 1 }),
      client.m3uAccounts(),
      client.epgSources(),
      client.stats().catch(() => null),
    ]);
    const live = stats?.live?.channels ?? [];
    return {
      account,
      profile: me.username,
      channels: channels.total,
      streams: streams.total,
      m3uAccounts: m3u.map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status ?? null,
        active: item.is_active !== false,
      })),
      epgSources: epg.map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status ?? null,
        active: item.is_active !== false,
      })),
      liveChannels: live.length,
      clients: live.reduce(
        (total, channel) => total + (channel.client_count ?? 0),
        0,
      ),
    };
  } catch (error) {
    throw new BadRequestException(
      `O Dispatcharr não respondeu: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
