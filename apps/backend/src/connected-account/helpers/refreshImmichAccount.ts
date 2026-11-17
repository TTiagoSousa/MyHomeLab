import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { createImmichClient } from 'src/immich/immich.client';
import { findConnectedAccount } from './findConnectedAccount';

/**
 * O estado do Immich visto agora: o utilizador da chave (e se é admin), as permissões
 * da chave, as fotos e os vídeos, o disco e as filas com falhas.
 */
export async function refreshImmichAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.IMMICH) {
    throw new BadRequestException('Esta conta não é um Immich');
  }
  if (!account.baseUrl || !account.accessToken) {
    throw new BadRequestException(
      'O Immich já não tem chave de API. Liga-o outra vez com uma chave nova.',
    );
  }
  try {
    const client = createImmichClient(account.baseUrl, account.accessToken);
    const [me, key, mine, storage] = await Promise.all([
      client.me(),
      client.apiKey().catch(() => null),
      client.myStatistics(),
      client.storage(),
    ]);
    const queues = me.isAdmin ? await client.queues().catch(() => null) : null;
    const current =
      me.isAdmin !== account.isAdmin
        ? await repository.update(account.id, { isAdmin: me.isAdmin })
        : account;
    return {
      account: current,
      profile: me.name,
      isAdmin: me.isAdmin,
      permissions: key?.permissions ?? null,
      photos: mine.images,
      videos: mine.videos,
      diskUse: storage.diskUse,
      diskSize: storage.diskSize,
      diskPercent: Math.round(storage.diskUsagePercentage),
      failedJobs: queues
        ? queues.reduce((total, queue) => total + queue.statistics.failed, 0)
        : null,
      pausedQueues: queues
        ? queues.filter((queue) => queue.isPaused).map((queue) => queue.name)
        : null,
    };
  } catch (error) {
    throw new BadRequestException(
      `O Immich não respondeu: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
