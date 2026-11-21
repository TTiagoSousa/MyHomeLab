import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { CreateTplinkRouterAccountDto } from '../dto/create-tplink-router-account.dto';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  forgetTplinkRouter,
  normalizeTplinkUrl,
  probeTplinkRouter,
  tplinkScopes,
} from 'src/tplink-router/tplink-router.client';

/**
 * Liga um router ou um extensor TP-Link (Archer, RE) com a palavra-passe local da página de gestão: descobre a
 * maneira de entrar (classic, v1_11 ou sg), lê o modelo e o firmware e sai logo (a página só
 * aceita uma sessão). Guarda o utilizador em username, a palavra-passe cifrada em appPassword e a
 * maneira de entrar em scopes ("tplink:<maneira>"), para não a voltar a adivinhar. O mesmo
 * endereço já ligado fica com a palavra-passe nova.
 */
export async function createTplinkRouterAccount(
  dto: CreateTplinkRouterAccountDto,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const baseUrl = normalizeTplinkUrl(dto.baseUrl);
  const username = dto.username?.trim() || 'admin';
  let probe: Awaited<ReturnType<typeof probeTplinkRouter>>;
  try {
    probe = await probeTplinkRouter({
      baseUrl,
      username,
      password: dto.password,
    });
  } catch (error) {
    throw new BadRequestException(
      `Não foi possível ligar ao router: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const name =
    probe.firmware.model ||
    (probe.kind === 'extender' ? 'Extensor TP-Link' : 'Router TP-Link');
  const existing = (
    await repository.findAllByUser(userId, ConnectionProvider.TPLINK_ROUTER)
  ).find((account) => account.baseUrl === baseUrl);
  if (existing) {
    forgetTplinkRouter(existing.id);
    return repository.update(existing.id, {
      username,
      appPassword: dto.password,
      scopes: tplinkScopes(probe.scheme, probe.kind),
      appVersion: probe.firmware.firmwareVersion || null,
      isActive: true,
      ...(dto.displayName?.trim()
        ? { displayName: dto.displayName.trim() }
        : {}),
    });
  }
  const created = await repository.create({
    userId,
    provider: ConnectionProvider.TPLINK_ROUTER,
    displayName: dto.displayName?.trim() || name,
    baseUrl,
    username,
    appPassword: dto.password,
    scopes: tplinkScopes(probe.scheme, probe.kind),
    isAdmin: true,
  });
  return probe.firmware.firmwareVersion
    ? repository.update(created.id, {
        appVersion: probe.firmware.firmwareVersion,
      })
    : created;
}
