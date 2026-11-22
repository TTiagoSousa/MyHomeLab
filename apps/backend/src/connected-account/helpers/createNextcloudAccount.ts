import { BadRequestException, Logger } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { CreateNextcloudAccountDto } from '../dto/create-nextcloud-account.dto';
import { createNextcloudFiles } from 'src/backup/helpers/nextcloudFiles';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { nextcloudRoot } from 'src/nextcloud/nextcloud.client';

const logger = new Logger('createNextcloudAccount');

export async function createNextcloudAccount(
  dto: CreateNextcloudAccountDto,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const existing = await repository.findByUserAndCaldav(
    userId,
    dto.caldavUrl,
    dto.caldavUsername,
  );

  // A conta serve para os backups (WebDAV): basta o Nextcloud aceitar o utilizador.
  try {
    await createNextcloudFiles(
      dto.caldavUrl.replace(/\/remote\.php\/.*$/i, ''),
      dto.caldavUsername,
      dto.caldavPassword,
    ).account();
  } catch (error) {
    logger.error(
      `Falha ao ligar ao Nextcloud (${dto.caldavUrl})`,
      error instanceof Error ? (error.stack ?? error.message) : error,
    );
    throw new BadRequestException(
      'Não foi possível ligar ao Nextcloud — verifica o URL, utilizador e password',
    );
  }

  // A mesma conta (ligada ou desligada) fica com a password nova: a linha guarda o
  // que estava ligado a ela (backups, histórico) — religar não cria uma segunda.
  if (existing) {
    return repository.update(existing.id, {
      displayName: dto.displayName,
      baseUrl: nextcloudRoot(dto.caldavUrl),
      caldavPassword: dto.caldavPassword,
      isActive: true,
      disconnectedAt: null,
    });
  }

  return repository.create({
    userId,
    provider: ConnectionProvider.NEXTCLOUD,
    displayName: dto.displayName,
    // A raiz (versão, apps, CalDAV); o caldavUrl fica como ele o escreveu.
    baseUrl: nextcloudRoot(dto.caldavUrl),
    caldavUrl: dto.caldavUrl,
    caldavUsername: dto.caldavUsername,
    caldavPassword: dto.caldavPassword,
  });
}
