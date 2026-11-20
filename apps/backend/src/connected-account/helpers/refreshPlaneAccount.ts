import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { createPlaneClient, planeInstance } from 'src/plane/plane.client';
import { findConnectedAccount } from './findConnectedAccount';

/** O Plane visto agora: o utilizador do token, o espaço, os projetos e a edição. */
export async function refreshPlaneAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.PLANE) {
    throw new BadRequestException('Esta conta não é um Plane');
  }
  if (!account.baseUrl || !account.accessToken || !account.username) {
    throw new BadRequestException(
      'O Plane já não tem token. Liga-o outra vez com um token novo.',
    );
  }
  try {
    const client = createPlaneClient(
      account.baseUrl,
      account.accessToken,
      account.username,
    );
    const [instance, user, projects] = await Promise.all([
      planeInstance(account.baseUrl),
      client.me(),
      client.projects(),
    ]);
    const open = projects.filter((project) => !project.archived_at);
    return {
      account,
      profile: user.display_name,
      workspace: account.username,
      edition: instance.edition ?? null,
      projects: open.map((project) => ({
        id: project.id,
        name: project.name,
        identifier: project.identifier,
      })),
    };
  } catch (error) {
    throw new BadRequestException(
      `O Plane não respondeu: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
