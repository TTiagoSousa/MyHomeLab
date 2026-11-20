import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { CreateCoolifyAccountDto } from '../dto/create-coolify-account.dto';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  createCoolifyClient,
  normalizeCoolifyUrl,
} from 'src/coolify/coolify.client';

/**
 * Liga um Coolify com um token de API: confirma que o token entra e que a API está ligada (a
 * versão) e que chega aos servidores. Guarda o token cifrado e, em username, o nome da equipa
 * do token (cada token é de uma equipa). O mesmo endereço já ligado fica com o token novo.
 */
export async function createCoolifyAccount(
  dto: CreateCoolifyAccountDto,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const baseUrl = normalizeCoolifyUrl(dto.baseUrl);
  const token = dto.apiToken.trim();
  let team: string | undefined;
  try {
    const client = createCoolifyClient(baseUrl, token);
    await client.version();
    await client.servers();
    team = await client
      .currentTeam()
      .then((body) => body.name)
      .catch(() => undefined);
  } catch (error) {
    throw new BadRequestException(
      `Não foi possível ligar ao Coolify: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const existing = (
    await repository.findAllByUser(userId, ConnectionProvider.COOLIFY)
  ).find((account) => account.baseUrl === baseUrl);
  if (existing) {
    return repository.update(existing.id, {
      accessToken: token,
      isActive: true,
      ...(dto.displayName?.trim()
        ? { displayName: dto.displayName.trim() }
        : {}),
    });
  }
  return repository.create({
    userId,
    provider: ConnectionProvider.COOLIFY,
    displayName: dto.displayName?.trim() || 'Coolify',
    accessToken: token,
    baseUrl,
    username: team,
  });
}
