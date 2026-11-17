import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  createSolidtimeClient,
  solidtimeTime,
} from 'src/solidtime/solidtime.client';
import { findConnectedAccount } from './findConnectedAccount';

/**
 * O estado do solidtime visto agora: o utilizador, a organização e o papel, o cronómetro
 * a contar, as horas dos últimos 7 dias e quantos projetos e clientes há.
 */
export async function refreshSolidtimeAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.SOLIDTIME) {
    throw new BadRequestException('Esta conta não é um solidtime');
  }
  if (!account.baseUrl || !account.accessToken) {
    throw new BadRequestException(
      'O solidtime já não tem token. Liga-o outra vez com um token novo.',
    );
  }
  try {
    const client = createSolidtimeClient(account.baseUrl, account.accessToken);
    const [user, memberships, active] = await Promise.all([
      client.me(),
      client.memberships(),
      client.activeEntry(),
    ]);
    const membership = memberships.find((item) => item.id === account.username);
    if (!membership) {
      throw new Error(
        'o utilizador do token já não está na organização desta ligação',
      );
    }
    const organization = membership.organization.id;
    const [week, projects, clients] = await Promise.all([
      client.aggregate(organization, {
        group: 'day',
        start: solidtimeTime(new Date(Date.now() - 7 * 86_400_000)),
        end: solidtimeTime(new Date()),
        member_id: membership.id,
      }),
      client.objects(organization, 'projects'),
      client.objects(organization, 'clients'),
    ]);
    const isAdmin = ['owner', 'admin'].includes(membership.role);
    const current =
      isAdmin !== account.isAdmin
        ? await repository.update(account.id, { isAdmin })
        : account;
    return {
      account: current,
      profile: user.name,
      organization: membership.organization.name,
      role: membership.role,
      isAdmin,
      running: active
        ? {
            description: active.description,
            start: active.start,
            project:
              projects.find((project) => project.id === active.project_id)
                ?.name ?? null,
          }
        : null,
      weekSeconds: week.seconds,
      projects: projects.filter((project) => !project.is_archived).length,
      clients: clients.length,
    };
  } catch (error) {
    throw new BadRequestException(
      `O solidtime não respondeu: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
