import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { CreatePaperlessAccountDto } from '../dto/create-paperless-account.dto';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  createPaperlessClient,
  normalizePaperlessUrl,
  PaperlessUser,
} from 'src/paperless/paperless.client';

/**
 * Liga um Paperless com o token da API: confirma que o token entra e que é um Paperless
 * (/api/ui_settings com o cabeçalho X-Version), e guarda-o cifrado. O mesmo utilizador
 * já ligado neste endereço fica com o token novo.
 */
export async function createPaperlessAccount(
  dto: CreatePaperlessAccountDto,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const baseUrl = normalizePaperlessUrl(dto.baseUrl);
  const token = dto.token.trim();
  let user: PaperlessUser;
  try {
    const me = await createPaperlessClient(baseUrl, token).me();
    if (!me.version || !me.user?.username) {
      throw new Error(
        'Este endereço não é um Paperless-ngx (não diz a versão).',
      );
    }
    user = me.user;
  } catch (error) {
    throw new BadRequestException(
      `Não foi possível ligar ao Paperless: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const existing = (
    await repository.findAllByUser(userId, ConnectionProvider.PAPERLESS)
  ).find(
    (account) =>
      account.baseUrl === baseUrl && account.username === String(user.id),
  );
  if (existing) {
    return repository.update(existing.id, {
      accessToken: token,
      isAdmin: user.is_superuser,
      isActive: true,
      ...(dto.displayName?.trim()
        ? { displayName: dto.displayName.trim() }
        : {}),
    });
  }

  return repository.create({
    userId,
    provider: ConnectionProvider.PAPERLESS,
    displayName: dto.displayName?.trim() || user.username || undefined,
    accessToken: token,
    baseUrl,
    // O id do utilizador (estável); o nome mostra-se no displayName.
    username: String(user.id),
    isAdmin: user.is_superuser,
  });
}
