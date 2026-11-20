import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { CreateClickHouseAccountDto } from '../dto/create-clickhouse-account.dto';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { toHttpError } from 'src/integrations/app-integration.error';
import {
  createClickhouseClient,
  normalizeClickhouseUrl,
} from 'src/clickhouse/clickhouse.client';

/**
 * Liga um ClickHouse pela interface HTTP com um utilizador e a password: confirma que o
 * endereço é um ClickHouse e que o login entra (SELECT currentUser(), version()). Guarda o
 * utilizador em username e a password cifrada em accessToken (o update do repositório só cifra
 * esse campo, e assim religar com uma password nova funciona). O mesmo endereço com o mesmo
 * utilizador fica com a password nova. isAdmin diz se pode ver o acesso (SHOW ACCESS).
 */
export async function createClickHouseAccount(
  dto: CreateClickHouseAccountDto,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const baseUrl = normalizeClickhouseUrl(dto.baseUrl);
  const username = dto.username.trim();
  const password = dto.password ?? '';
  let isAdmin = false;
  try {
    const client = createClickhouseClient(baseUrl, username, password);
    const me = await client.whoami();
    if (!me?.version) {
      throw new Error('este endereço não respondeu como um ClickHouse');
    }
    isAdmin = await client
      .raw('SHOW ACCESS')
      .then(() => true)
      .catch(() => false);
  } catch (error) {
    const http = toHttpError(error);
    if (http !== error) throw http;
    throw new BadRequestException(
      `Não foi possível ligar ao ClickHouse: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const existing = (
    await repository.findAllByUser(userId, ConnectionProvider.CLICKHOUSE)
  ).find(
    (account) => account.baseUrl === baseUrl && account.username === username,
  );
  if (existing) {
    return repository.update(existing.id, {
      accessToken: password,
      isActive: true,
      isAdmin,
      ...(dto.displayName?.trim()
        ? { displayName: dto.displayName.trim() }
        : {}),
    });
  }
  return repository.create({
    userId,
    provider: ConnectionProvider.CLICKHOUSE,
    displayName: dto.displayName?.trim() || 'ClickHouse',
    baseUrl,
    username,
    accessToken: password,
    isAdmin,
  });
}
