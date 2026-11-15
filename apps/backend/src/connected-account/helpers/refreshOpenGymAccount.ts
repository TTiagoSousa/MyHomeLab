import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  createOpenGymClient,
  openGymHealth,
  tokenExpiry,
} from 'src/opengym/opengym.client';
import { findConnectedAccount } from './findConnectedAccount';

/**
 * O estado do openGym visto agora: o servidor (e se o disco aceita escritas), o
 * perfil do token e o que lá está (rotinas, treinos, o plano da semana). A meio da
 * validade o openGym renova o token: guarda-se o novo.
 */
export async function refreshOpenGymAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.OPENGYM) {
    throw new BadRequestException('Esta conta não é uma conta openGym');
  }
  if (!account.baseUrl || !account.accessToken) {
    throw new BadRequestException(
      'O openGym já não tem token. Liga-o outra vez com um código novo.',
    );
  }
  try {
    const health = await openGymHealth(account.baseUrl);
    const client = createOpenGymClient(account.baseUrl, account.accessToken);
    const me = await client.me();
    const data = await client.data();
    const state = data.state ?? {};
    const isAdmin = Boolean(me.user.admin);
    const renewed = me.token && me.token !== account.accessToken;
    const expiry = renewed ? tokenExpiry(me.token!) : null;
    const current =
      renewed || isAdmin !== account.isAdmin
        ? await repository.update(account.id, {
            isAdmin,
            ...(renewed ? { accessToken: me.token! } : {}),
            ...(expiry ? { tokenExpiresAt: expiry } : {}),
          })
        : account;
    const workouts = state.workouts ?? [];
    return {
      account: current,
      profile: me.user.name,
      isAdmin,
      writable: health.writable,
      users: health.users,
      routines: (state.routines ?? []).length,
      workouts: workouts.length,
      lastWorkout:
        workouts
          .map((workout) => workout.d)
          .filter((day): day is string => Boolean(day))
          .sort()
          .pop() ?? null,
      plannedDays: Object.values(state.week ?? {}).filter((value) =>
        Array.isArray(value) ? value.length > 0 : Boolean(value),
      ).length,
      tokenExpiresAt: current.tokenExpiresAt,
    };
  } catch (error) {
    throw new BadRequestException(
      `O openGym não respondeu: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
