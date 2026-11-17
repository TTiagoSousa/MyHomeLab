import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { CreateSolidtimeAccountDto } from '../dto/create-solidtime-account.dto';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  createSolidtimeClient,
  normalizeSolidtimeUrl,
  SolidtimeMembership,
  SolidtimeUser,
  solidtimeUp,
} from 'src/solidtime/solidtime.client';

const normalize = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * Liga um solidtime com um token pessoal: confirma que está de pé (/health-check/up), que o
 * token entra (/users/me) e escolhe a organização (a única, ou a do nome pedido). Guarda o
 * token cifrado e, em username, o membro dessa organização (cada ligação é uma
 * organização). O mesmo membro no mesmo endereço fica com o token novo.
 */
export async function createSolidtimeAccount(
  dto: CreateSolidtimeAccountDto,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const baseUrl = normalizeSolidtimeUrl(dto.baseUrl);
  const token = dto.token.trim();
  let user: SolidtimeUser;
  let memberships: SolidtimeMembership[];
  try {
    await solidtimeUp(baseUrl);
    const client = createSolidtimeClient(baseUrl, token);
    [user, memberships] = await Promise.all([
      client.me(),
      client.memberships(),
    ]);
  } catch (error) {
    throw new BadRequestException(
      `Não foi possível ligar ao solidtime: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const wanted = dto.organization?.trim();
  const matches = wanted
    ? memberships.filter((item) =>
        normalize(item.organization.name).includes(normalize(wanted)),
      )
    : memberships;
  if (matches.length !== 1) {
    throw new BadRequestException(
      memberships.length
        ? `Escreve a organização: ${memberships.map((item) => item.organization.name).join(', ')}.`
        : 'O utilizador do token não está em nenhuma organização.',
    );
  }
  const membership = matches[0];
  const name =
    dto.displayName?.trim() ||
    (memberships.length > 1 ? membership.organization.name : user.name);

  const existing = (
    await repository.findAllByUser(userId, ConnectionProvider.SOLIDTIME)
  ).find(
    (account) =>
      account.baseUrl === baseUrl && account.username === membership.id,
  );
  const isAdmin = ['owner', 'admin'].includes(membership.role);
  if (existing) {
    return repository.update(existing.id, {
      accessToken: token,
      isAdmin,
      isActive: true,
      ...(dto.displayName?.trim() ? { displayName: name } : {}),
    });
  }
  return repository.create({
    userId,
    provider: ConnectionProvider.SOLIDTIME,
    displayName: name || undefined,
    emailAddress: user.email,
    accessToken: token,
    baseUrl,
    // O membro da organização (estável); dele sai a organização desta ligação.
    username: membership.id,
    isAdmin,
  });
}
