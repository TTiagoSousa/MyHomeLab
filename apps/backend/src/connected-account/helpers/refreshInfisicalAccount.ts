import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  createInfisicalClient,
  infisicalUpdate,
} from 'src/infisical/infisical.client';
import { findConnectedAccount } from './findConnectedAccount';

/** O Infisical visto agora: os projetos que a identidade vê, os ambientes de cada um e se há versão nova. */
export async function refreshInfisicalAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.INFISICAL) {
    throw new BadRequestException('Esta conta não é um Infisical');
  }
  if (!account.baseUrl || !account.apiClientId || !account.apiClientSecret) {
    throw new BadRequestException(
      'O Infisical já não tem a Machine Identity. Liga-o outra vez com um client secret novo.',
    );
  }
  try {
    const client = createInfisicalClient(
      account.baseUrl,
      account.apiClientId,
      account.apiClientSecret,
    );
    const [projects, updateAvailable] = await Promise.all([
      client.projects(),
      infisicalUpdate(account.baseUrl),
    ]);
    return {
      account,
      clientId: account.apiClientId,
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        environments: project.environments.map((env) => env.slug),
      })),
      updateAvailable,
    };
  } catch (error) {
    throw new BadRequestException(
      `O Infisical não respondeu: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
