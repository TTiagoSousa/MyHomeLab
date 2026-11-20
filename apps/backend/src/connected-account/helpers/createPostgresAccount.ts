import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { CreatePostgresAccountDto } from '../dto/create-postgres-account.dto';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { toHttpError } from 'src/integrations/app-integration.error';
import {
  cleanPostgresHost,
  postgresUrl,
  withPostgres,
} from 'src/postgres/postgres.client';

/**
 * Liga um PostgreSQL diretamente (host, porta, base, utilizador, password, SSL): confirma
 * que entra e lê a versão e se o utilizador é superuser (ou tem pg_monitor/pg_signal_backend).
 * Em baseUrl fica "postgres://host:porta/base?sslmode=…" — nunca a password, que vai cifrada
 * em accessToken (o update do repositório só cifra esse campo, e assim religar com uma
 * password nova funciona). O mesmo servidor e base com o mesmo utilizador fica com a nova.
 */
export async function createPostgresAccount(
  dto: CreatePostgresAccountDto,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const cleaned = cleanPostgresHost(dto.host);
  if (!cleaned.host) throw new BadRequestException('Falta o host.');
  const baseUrl = postgresUrl({
    host: cleaned.host,
    port: dto.port ?? cleaned.port ?? 5432,
    database: dto.database?.trim() || 'postgres',
    ssl: dto.ssl ?? 'off',
  });
  const username = dto.username.trim();
  let isAdmin = false;
  try {
    isAdmin = await withPostgres(
      { baseUrl, user: username, password: dto.password },
      async (client) => {
        const { rows } = await client.query<{ admin: boolean }>(
          "SELECT rolsuper OR pg_has_role(current_user, 'pg_monitor', 'MEMBER') AS admin FROM pg_roles WHERE rolname = current_user",
        );
        return rows[0]?.admin === true;
      },
    );
  } catch (error) {
    const http = toHttpError(error);
    if (http !== error) throw http;
    throw new BadRequestException(
      `Não foi possível ligar ao PostgreSQL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const existing = (
    await repository.findAllByUser(userId, ConnectionProvider.POSTGRES)
  ).find(
    (account) => account.baseUrl === baseUrl && account.username === username,
  );
  if (existing) {
    return repository.update(existing.id, {
      accessToken: dto.password,
      isActive: true,
      isAdmin,
      ...(dto.displayName?.trim()
        ? { displayName: dto.displayName.trim() }
        : {}),
    });
  }
  return repository.create({
    userId,
    provider: ConnectionProvider.POSTGRES,
    displayName: dto.displayName?.trim() || 'PostgreSQL',
    baseUrl,
    username,
    accessToken: dto.password,
    isAdmin,
  });
}
