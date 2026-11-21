import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  TPLINK_BANDS,
  TPLINK_NETWORKS,
  tplinkConnection,
  TplinkOfflineError,
  TplinkRouterApi,
  TplinkWifi,
  withTplinkRouter,
} from 'src/tplink-router/tplink-router.client';
import { findConnectedAccount } from './findConnectedAccount';

/** Tudo o que a página do router mostra, lido numa só sessão. */
async function readEverything(router: TplinkRouterApi) {
  const firmware = await router.firmware();
  const status = await router.status(true);
  const wifi: TplinkWifi[] = [];
  for (const network of TPLINK_NETWORKS) {
    for (const band of TPLINK_BANDS) {
      if (status.wifi[network][band] === null) continue;
      const item = await router.wifi(network, band).catch(() => null);
      if (item) wifi.push(item);
    }
  }
  const optional = <T>(promise: Promise<T>, fallback: T) =>
    promise.catch(() => fallback);
  return {
    kind: router.kind,
    firmware,
    status,
    wifi,
    repeater: await optional(router.repeater(), null),
    ports: await optional(router.ports(), []),
    mesh: await optional(router.mesh(), []),
    leases: await optional(router.leases(), []),
    reservations: await optional(router.reservations(), []),
    portForwards: await optional(router.portForwards(), []),
    accessControl: await optional(router.accessControl(), null),
    blocked: await optional(router.blocked(), []),
  };
}

/**
 * O router visto agora. Desligado (a sessão caiu, o router não responde) não é um erro: volta
 * `connection` com o estado e a próxima tentativa, e `router` a null. `force` tenta já, mesmo
 * antes da próxima tentativa (o botão "Ligar agora").
 */
export async function refreshTplinkRouterAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
  force = false,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.TPLINK_ROUTER) {
    throw new BadRequestException('Esta conta não é um router TP-Link');
  }
  if (!account.baseUrl || !account.appPassword) {
    throw new BadRequestException(
      'O router já não tem a palavra-passe guardada. Liga-o outra vez.',
    );
  }
  try {
    const router = await withTplinkRouter(account, readEverything, { force });
    const checked =
      router.firmware.firmwareVersion &&
      router.firmware.firmwareVersion !== account.appVersion
        ? await repository.update(account.id, {
            appVersion: router.firmware.firmwareVersion,
          })
        : account;
    return { account: checked, connection: tplinkConnection(account), router };
  } catch (error) {
    if (error instanceof TplinkOfflineError) {
      return { account, connection: error.connection, router: null };
    }
    throw new BadRequestException(
      `O router respondeu com erro: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
