import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { createPaperlessClient } from 'src/paperless/paperless.client';
import { findConnectedAccount } from './findConnectedAccount';

/**
 * O estado do Paperless visto agora: o utilizador do token (e se é superutilizador), os
 * documentos e a caixa de entrada, e — de um superutilizador — o disco, a saúde e as
 * tarefas falhadas.
 */
export async function refreshPaperlessAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.PAPERLESS) {
    throw new BadRequestException('Esta conta não é um Paperless');
  }
  if (!account.baseUrl || !account.accessToken) {
    throw new BadRequestException(
      'O Paperless já não tem token. Liga-o outra vez com um token novo.',
    );
  }
  try {
    const client = createPaperlessClient(account.baseUrl, account.accessToken);
    const [{ user, permissions }, statistics] = await Promise.all([
      client.me(),
      client.statistics(),
    ]);
    const [status, tasks] = await Promise.all([
      client.status().catch(() => null),
      client.tasks().catch(() => null),
    ]);
    const current =
      user.is_superuser !== account.isAdmin
        ? await repository.update(account.id, { isAdmin: user.is_superuser })
        : account;
    const problems = status
      ? Object.entries({
          database: status.database.status,
          redis: status.tasks.redis_status,
          celery: status.tasks.celery_status,
          index: status.tasks.index_status,
          classifier: status.tasks.classifier_status,
          sanity: status.tasks.sanity_check_status,
        })
          .filter(([, value]) => value && value !== 'OK')
          .map(([key]) => key)
      : null;
    return {
      account: current,
      profile: user.username,
      isAdmin: user.is_superuser,
      isStaff: user.is_staff,
      permissions,
      documents: statistics.documents_total,
      inbox: statistics.documents_inbox,
      tags: statistics.tag_count ?? null,
      correspondents: statistics.correspondent_count ?? null,
      diskFree: status ? status.storage.available : null,
      diskTotal: status ? status.storage.total : null,
      problems,
      failedTasks: tasks
        ? tasks.filter(
            (task) => task.status === 'FAILURE' && !task.acknowledged,
          ).length
        : null,
    };
  } catch (error) {
    throw new BadRequestException(
      `O Paperless não respondeu: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
