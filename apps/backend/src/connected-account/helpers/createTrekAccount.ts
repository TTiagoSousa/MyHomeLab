import { ConflictException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { CreateTrekAccountDto } from '../dto/create-trek-account.dto';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { toHttpError } from 'src/integrations/app-integration.error';
import {
  createTrekAdminClient,
  fetchTrekAppConfig,
  normalizeTrekUrl,
} from 'src/trek/trek.client';
import { trekMcpTools } from 'src/trek/trekMcp.client';

/**
 * Liga um TREK com o email e a password de um administrador. Antes de guardar
 * confirma que o endereço é um TREK e que a conta entra e é admin — sem isso os
 * backups não funcionariam.
 */
export async function createTrekAccount(
  dto: CreateTrekAccountDto,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const baseUrl = normalizeTrekUrl(dto.baseUrl);
  const email = dto.email.trim().toLowerCase();

  const clientId = dto.mcpClientId?.trim() || undefined;
  const clientSecret = dto.mcpClientSecret?.trim() || undefined;
  try {
    await fetchTrekAppConfig(baseUrl);
    await createTrekAdminClient(baseUrl, email, dto.password).assertAdmin();
    // Com o cliente MCP, confirma-se já que entra (lista as ferramentas).
    if (clientId && clientSecret) {
      await trekMcpTools({ baseUrl, clientId, clientSecret }, true);
    }
  } catch (error) {
    throw toHttpError(error);
  }

  const existing = (
    await repository.findAllByUser(userId, ConnectionProvider.TREK)
  ).find((account) => account.baseUrl === baseUrl);
  if (existing) {
    throw new ConflictException('Este TREK já está ligado');
  }

  return repository.create({
    userId,
    provider: ConnectionProvider.TREK,
    displayName: dto.displayName?.trim() || undefined,
    baseUrl,
    username: email,
    appPassword: dto.password,
    isAdmin: true,
    ...(clientId && clientSecret
      ? { apiClientId: clientId, apiClientSecret: clientSecret }
      : {}),
  });
}
