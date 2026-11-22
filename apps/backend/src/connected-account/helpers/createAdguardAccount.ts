import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { CreateAdguardAccountDto } from '../dto/create-adguard-account.dto';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { toHttpError } from 'src/integrations/app-integration.error';
import {
  createAdguardClient,
  normalizeAdguardUrl,
} from 'src/adguard/adguard.client';

/**
 * Liga um AdGuard Home com o utilizador e a password do painel. Antes de
 * guardar confirma que o endereço responde e que as credenciais entram — sem
 * isso os agentes, os avisos de versão e os backups falhariam.
 */
export async function createAdguardAccount(
  dto: CreateAdguardAccountDto,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const baseUrl = normalizeAdguardUrl(dto.baseUrl);
  const username = dto.username.trim();

  try {
    await createAdguardClient(baseUrl, username, dto.password).status();
  } catch (error) {
    throw toHttpError(error);
  }

  const existing = (
    await repository.findAllByUser(userId, ConnectionProvider.ADGUARD)
  ).find((account) => account.baseUrl === baseUrl);
  // O mesmo AdGuard fica com as credenciais novas (o histórico e o CT ficam na conta).
  if (existing) {
    return repository.update(existing.id, {
      username,
      appPassword: dto.password,
      isActive: true,
      ...(dto.displayName?.trim()
        ? { displayName: dto.displayName.trim() }
        : {}),
    });
  }

  return repository.create({
    userId,
    provider: ConnectionProvider.ADGUARD,
    displayName: dto.displayName?.trim() || undefined,
    baseUrl,
    username,
    appPassword: dto.password,
    isAdmin: true,
  });
}
