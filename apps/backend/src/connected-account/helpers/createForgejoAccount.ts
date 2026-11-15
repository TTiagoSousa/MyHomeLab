import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { CreateForgejoAccountDto } from '../dto/create-forgejo-account.dto';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  ForgejoUser,
  createForgejoClient,
  normalizeForgejoUrl,
} from 'src/forgejo/forgejo.client';

/**
 * Liga uma instância Forgejo com um token. Antes de guardar, pergunta ao Forgejo
 * quem é o dono do token: assim um endereço ou um token errados falham já, e não
 * mais tarde no meio de uma conversa com o assistente.
 */
export async function createForgejoAccount(
  dto: CreateForgejoAccountDto,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const baseUrl = normalizeForgejoUrl(dto.baseUrl);
  const token = dto.token.trim();

  let user: ForgejoUser;
  try {
    user = await createForgejoClient({ baseUrl, token }).me();
  } catch (error) {
    throw new BadRequestException(
      `Não foi possível ligar ao Forgejo — verifica o endereço e o token (${
        error instanceof Error ? error.message : String(error)
      })`,
    );
  }

  const existing = (
    await repository.findAllByUser(userId, ConnectionProvider.FORGEJO)
  ).find(
    (account) => account.baseUrl === baseUrl && account.username === user.login,
  );
  if (existing) {
    throw new ConflictException('Já tens esta conta Forgejo ligada');
  }

  return repository.create({
    userId,
    provider: ConnectionProvider.FORGEJO,
    displayName: dto.displayName?.trim() || undefined,
    emailAddress: user.email || undefined,
    accessToken: token,
    baseUrl,
    username: user.login,
    isAdmin: user.is_admin,
  });
}
