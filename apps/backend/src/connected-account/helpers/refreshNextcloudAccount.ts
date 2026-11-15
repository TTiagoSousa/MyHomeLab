import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  nextcloudAppUpdates,
  nextcloudForAccount,
  nextcloudRoot,
  nextcloudStoreApps,
} from 'src/nextcloud/nextcloud.client';
import { findConnectedAccount } from './findConnectedAccount';

/**
 * O estado do Nextcloud, visto agora: se a password de app ainda vale, se a
 * conta é administradora (sem isso não se veem as apps), se está em manutenção,
 * quantas apps estão ligadas e quais têm versão nova na App Store. Guarda o "é
 * admin" e, numa conta antiga, a raiz (baseUrl).
 */
export async function refreshNextcloudAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const found = await findConnectedAccount(id, userId, repository);
  if (found.provider !== ConnectionProvider.NEXTCLOUD) {
    throw new BadRequestException('Esta conta não é uma conta Nextcloud');
  }
  if (!found.caldavPassword) {
    throw new BadRequestException(
      'A conta Nextcloud já não tem password de app. Liga-a outra vez.',
    );
  }
  const account =
    !found.baseUrl && found.caldavUrl
      ? await repository.update(found.id, {
          baseUrl: nextcloudRoot(found.caldavUrl),
        })
      : found;
  const client = nextcloudForAccount(account);
  try {
    const [status, user] = await Promise.all([client.status(), client.me()]);
    const current =
      user.isAdmin !== account.isAdmin
        ? await repository.update(account.id, { isAdmin: user.isAdmin })
        : account;
    const apps = user.isAdmin ? await client.apps() : [];
    const store = user.isAdmin
      ? await nextcloudStoreApps(status.version).catch(() => null)
      : null;
    return {
      account: current,
      login: user.id,
      displayName: user.displayName,
      isAdmin: user.isAdmin,
      maintenance: status.maintenance,
      needsDbUpgrade: status.needsDbUpgrade,
      apps: apps.length,
      appUpdates: store ? nextcloudAppUpdates(apps, store) : [],
      storeReachable: Boolean(store),
    };
  } catch (error) {
    throw new BadRequestException(
      `O Nextcloud não respondeu: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
