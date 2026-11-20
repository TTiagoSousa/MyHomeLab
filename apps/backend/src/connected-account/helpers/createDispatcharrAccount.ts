import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { CreateDispatcharrAccountDto } from '../dto/create-dispatcharr-account.dto';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  createDispatcharrClient,
  dispatcharrVersionInfo,
  normalizeDispatcharrUrl,
} from 'src/dispatcharr/dispatcharr.client';

/** No Dispatcharr, o nível 10 é o de administrador (o que a API quase toda pede). */
const ADMIN_LEVEL = 10;

/**
 * Liga um Dispatcharr com a chave de API pessoal: confirma que é um Dispatcharr
 * (/api/core/version/), que a chave entra (/api/accounts/users/me/) e que é de um
 * administrador. Guarda a chave cifrada e, em username, o utilizador dela. O mesmo endereço
 * já ligado fica com a chave nova.
 */
export async function createDispatcharrAccount(
  dto: CreateDispatcharrAccountDto,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const baseUrl = normalizeDispatcharrUrl(dto.baseUrl);
  const apiKey = dto.apiKey.trim();
  let username: string;
  try {
    await dispatcharrVersionInfo(baseUrl);
    const me = await createDispatcharrClient(baseUrl, apiKey).me();
    if ((me.user_level ?? 0) < ADMIN_LEVEL) {
      throw new Error(
        `a chave é do utilizador «${me.username}», que não é administrador: gera a chave num administrador`,
      );
    }
    username = me.username;
  } catch (error) {
    throw new BadRequestException(
      `Não foi possível ligar ao Dispatcharr: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const existing = (
    await repository.findAllByUser(userId, ConnectionProvider.DISPATCHARR)
  ).find((account) => account.baseUrl === baseUrl);
  if (existing) {
    return repository.update(existing.id, {
      accessToken: apiKey,
      isActive: true,
      ...(dto.displayName?.trim()
        ? { displayName: dto.displayName.trim() }
        : {}),
    });
  }
  return repository.create({
    userId,
    provider: ConnectionProvider.DISPATCHARR,
    displayName: dto.displayName?.trim() || 'Dispatcharr',
    accessToken: apiKey,
    baseUrl,
    username,
    isAdmin: true,
  });
}
