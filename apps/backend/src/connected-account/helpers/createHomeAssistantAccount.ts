import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { CreateHomeAssistantAccountDto } from '../dto/create-home-assistant-account.dto';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { toHttpError } from 'src/integrations/app-integration.error';
import {
  createHomeAssistantClient,
  normalizeHomeAssistantUrl,
} from 'src/home-assistant/home-assistant.client';

/**
 * Liga um Home Assistant com um token de longa duração. Antes de guardar
 * confirma que o endereço responde e que o token é de um administrador: sem
 * isso os agentes não conseguem mexer nas automações, nos scripts nem nas
 * entidades, e os backups falham.
 */
export async function createHomeAssistantAccount(
  dto: CreateHomeAssistantAccountDto,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const baseUrl = normalizeHomeAssistantUrl(dto.baseUrl);
  const token = dto.token.trim();

  const client = createHomeAssistantClient(baseUrl, token);
  let user: Awaited<ReturnType<typeof client.currentUser>>;
  let locationName: string | undefined;
  try {
    locationName = (await client.config()).location_name;
    user = await client.currentUser();
  } catch (error) {
    throw toHttpError(error);
  }
  if (!user.is_admin) {
    throw new BadRequestException(
      `O token é de ${user.name}, que não é administrador do Home Assistant. Cria o token com uma conta de admin.`,
    );
  }

  const existing = (
    await repository.findAllByUser(userId, ConnectionProvider.HOME_ASSISTANT)
  ).find((account) => account.baseUrl === baseUrl);
  if (existing) {
    throw new ConflictException('Este Home Assistant já está ligado');
  }

  return repository.create({
    userId,
    provider: ConnectionProvider.HOME_ASSISTANT,
    displayName: dto.displayName?.trim() || locationName || undefined,
    accessToken: token,
    baseUrl,
    username: user.name,
    isAdmin: true,
  });
}
