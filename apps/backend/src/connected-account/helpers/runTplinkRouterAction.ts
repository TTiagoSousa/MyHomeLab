import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { TplinkRouterActionDto } from '../dto/tplink-router-action.dto';
import {
  TplinkOfflineError,
  TplinkRouterApi,
  withTplinkRouter,
} from 'src/tplink-router/tplink-router.client';
import { findConnectedAccount } from './findConnectedAccount';

const need = <T>(value: T | undefined, what: string): T => {
  if (value === undefined || value === null || value === '') {
    throw new BadRequestException(`Falta ${what}.`);
  }
  return value;
};

/** Faz a ação no router e diz o que ficou feito (em pt-PT, para o aviso da página). */
async function act(
  router: TplinkRouterApi,
  dto: TplinkRouterActionDto,
): Promise<string> {
  switch (dto.action) {
    case 'wifi': {
      const network = need(dto.network, 'a rede');
      const band = need(dto.band, 'a banda');
      const enabled = need(dto.enabled, 'ligar ou desligar');
      await router.setWifi(network, band, { enabled });
      return `Rede ${network} ${band.toUpperCase()} ${enabled ? 'ligada' : 'desligada'}.`;
    }
    case 'block':
      await router.block(need(dto.mac, 'o MAC'), dto.name ?? '');
      return `${dto.name || dto.mac} ficou na lista negra.`;
    case 'unblock':
      await router.unblock(need(dto.mac, 'o MAC'));
      return `${dto.name || dto.mac} saiu da lista negra.`;
    case 'accessControl':
      await router.setAccessControl({ enabled: dto.enabled, mode: dto.mode });
      return 'Controlo de acesso atualizado.';
    case 'reservationAdd':
      await router.addReservation(
        need(dto.mac, 'o MAC'),
        need(dto.ip, 'o IP'),
        dto.name ?? '',
      );
      return `IP ${dto.ip} reservado para ${dto.mac}.`;
    case 'reservationDelete':
      await router.deleteReservation(need(dto.mac, 'o MAC'));
      return `Reserva de ${dto.mac} apagada.`;
    case 'portForwardAdd':
      await router.addPortForward({
        name: need(dto.name, 'o nome'),
        ip: need(dto.ip, 'o IP'),
        externalPort: need(dto.externalPort, 'a porta de fora'),
        internalPort: need(dto.internalPort, 'a porta de dentro'),
        protocol: dto.protocol ?? 'TCP',
      });
      return `Regra «${dto.name}» criada.`;
    case 'portForwardDelete':
      await router.deletePortForward(need(dto.name, 'o nome'));
      return `Regra «${dto.name}» apagada.`;
    case 'wanRenew':
      await router.renewWan(true);
      return 'Pedi um IP novo à Internet.';
    case 'reboot':
      await router.reboot();
      return 'O router está a reiniciar (uns 2 minutos sem rede).';
  }
}

/**
 * Uma ação pedida na página do router. Desligado não é um erro: devolve `ok: false` com o
 * porquê e quando volta a tentar.
 */
export async function runTplinkRouterAction(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
  dto: TplinkRouterActionDto,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.TPLINK_ROUTER) {
    throw new BadRequestException('Esta conta não é um router TP-Link');
  }
  try {
    const message = await withTplinkRouter(account, (router) =>
      act(router, dto),
    );
    return { ok: true, message, connection: null };
  } catch (error) {
    if (error instanceof TplinkOfflineError) {
      return {
        ok: false,
        message: error.message,
        connection: error.connection,
      };
    }
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException(
      `O router não fez: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
