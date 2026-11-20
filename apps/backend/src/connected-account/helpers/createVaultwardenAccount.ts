import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { CreateVaultwardenAccountDto } from '../dto/create-vaultwarden-account.dto';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  createVaultwardenClient,
  normalizeVaultwardenUrl,
  vaultwardenVersion,
} from 'src/vaultwarden/vaultwarden.client';

/**
 * Liga um Vaultwarden com o ADMIN_TOKEN: confirma que é um Vaultwarden (/api/version), que o
 * token entra no painel de administração e que lê os utilizadores. Guarda o token cifrado
 * (accessToken). Os cofres ficam de fora: estão cifrados com a password mestra de cada um.
 * O mesmo endereço já ligado fica com o token novo.
 */
export async function createVaultwardenAccount(
  dto: CreateVaultwardenAccountDto,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const baseUrl = normalizeVaultwardenUrl(dto.baseUrl);
  const adminToken = dto.adminToken.trim();
  try {
    await vaultwardenVersion(baseUrl);
    const client = createVaultwardenClient(baseUrl, adminToken);
    await client.checkLogin();
    await client.users();
  } catch (error) {
    throw new BadRequestException(
      `Não foi possível ligar ao Vaultwarden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const existing = (
    await repository.findAllByUser(userId, ConnectionProvider.VAULTWARDEN)
  ).find((account) => account.baseUrl === baseUrl);
  if (existing) {
    return repository.update(existing.id, {
      accessToken: adminToken,
      isActive: true,
      isAdmin: true,
      ...(dto.displayName?.trim()
        ? { displayName: dto.displayName.trim() }
        : {}),
    });
  }
  return repository.create({
    userId,
    provider: ConnectionProvider.VAULTWARDEN,
    displayName: dto.displayName?.trim() || 'Vaultwarden',
    accessToken: adminToken,
    baseUrl,
    isAdmin: true,
  });
}
