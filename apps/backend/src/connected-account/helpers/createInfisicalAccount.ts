import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { CreateInfisicalAccountDto } from '../dto/create-infisical-account.dto';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  createInfisicalClient,
  infisicalStatus,
  normalizeInfisicalUrl,
} from 'src/infisical/infisical.client';

/**
 * Liga um Infisical com uma Machine Identity (Universal Auth): confirma que é um Infisical
 * (/api/status), que o client id e o client secret entram e que a identidade vê os projetos.
 * Guarda o client id em apiClientId e o client secret cifrado em apiClientSecret. A mesma
 * identidade no mesmo endereço fica com o segredo novo.
 */
export async function createInfisicalAccount(
  dto: CreateInfisicalAccountDto,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const baseUrl = normalizeInfisicalUrl(dto.baseUrl);
  const clientId = dto.clientId.trim();
  const clientSecret = dto.clientSecret.trim();
  try {
    const status = await infisicalStatus(baseUrl);
    if (!status.message && !status.date) {
      throw new Error('este endereço não é um Infisical (não diz o estado)');
    }
    const client = createInfisicalClient(baseUrl, clientId, clientSecret);
    await client.checkLogin();
    await client.projects();
  } catch (error) {
    throw new BadRequestException(
      `Não foi possível ligar ao Infisical: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const existing = (
    await repository.findAllByUser(userId, ConnectionProvider.INFISICAL)
  ).find(
    (account) =>
      account.baseUrl === baseUrl && account.apiClientId === clientId,
  );
  if (existing) {
    return repository.update(existing.id, {
      apiClientSecret: clientSecret,
      isActive: true,
      ...(dto.displayName?.trim()
        ? { displayName: dto.displayName.trim() }
        : {}),
    });
  }
  return repository.create({
    userId,
    provider: ConnectionProvider.INFISICAL,
    displayName: dto.displayName?.trim() || 'Infisical',
    baseUrl,
    apiClientId: clientId,
    apiClientSecret: clientSecret,
  });
}
