import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { CreateStirlingAccountDto } from '../dto/create-stirling-account.dto';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  createStirlingClient,
  normalizeStirlingUrl,
} from 'src/stirling/stirling.client';

/**
 * Liga um Stirling-PDF com a chave de API: confirma que é um Stirling (o estado com a versão)
 * e que a chave entra (a lista das operações), vê se é de administrador (as definições) e
 * guarda-a cifrada. O mesmo endereço já ligado fica com a chave nova.
 */
export async function createStirlingAccount(
  dto: CreateStirlingAccountDto,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const baseUrl = normalizeStirlingUrl(dto.baseUrl);
  const apiKey = dto.apiKey.trim();
  const client = createStirlingClient(baseUrl, apiKey);
  let isAdmin = false;
  try {
    const status = await client.status();
    if (!status.version) {
      throw new Error(
        'Este endereço não é um Stirling-PDF (não diz a versão).',
      );
    }
    await client.operations();
    isAdmin = await client
      .settings('system')
      .then(() => true)
      .catch(() => false);
  } catch (error) {
    throw new BadRequestException(
      `Não foi possível ligar ao Stirling-PDF: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const existing = (
    await repository.findAllByUser(userId, ConnectionProvider.STIRLING_PDF)
  ).find((account) => account.baseUrl === baseUrl);
  if (existing) {
    return repository.update(existing.id, {
      accessToken: apiKey,
      isAdmin,
      isActive: true,
      ...(dto.displayName?.trim()
        ? { displayName: dto.displayName.trim() }
        : {}),
    });
  }

  return repository.create({
    userId,
    provider: ConnectionProvider.STIRLING_PDF,
    displayName: dto.displayName?.trim() || 'Stirling-PDF',
    accessToken: apiKey,
    baseUrl,
    isAdmin,
  });
}
