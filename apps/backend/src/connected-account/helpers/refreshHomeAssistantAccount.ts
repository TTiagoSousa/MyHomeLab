import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { toHttpError } from 'src/integrations/app-integration.error';
import { createHomeAssistantClient } from 'src/home-assistant/home-assistant.client';
import { findConnectedAccount } from './findConnectedAccount';
import { haUpdates } from 'src/home-assistant/helpers/haUpdates';

const domainOf = (entityId: string) => entityId.split('.')[0];

/**
 * O estado do Home Assistant, visto agora: quem é o dono do token, o nome da
 * casa e quantas entidades, áreas, automações, scripts e cenas tem — o que os
 * agentes vão ver e alterar.
 */
export async function refreshHomeAssistantAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.HOME_ASSISTANT) {
    throw new BadRequestException('Esta conta não é um Home Assistant');
  }
  if (!account.baseUrl || !account.accessToken) {
    throw new BadRequestException(
      'O Home Assistant já não tem o token guardado. Liga-o outra vez.',
    );
  }
  const client = createHomeAssistantClient(
    account.baseUrl,
    account.accessToken,
  );
  try {
    const [config, states, user, registries] = await Promise.all([
      client.config(),
      client.states(),
      client.currentUser(),
      client.registries(),
    ]);
    const count = (domain: string) =>
      states.filter((state) => domainOf(state.entity_id) === domain).length;
    const updates = haUpdates(states, registries.entities);
    return {
      account,
      locationName: config.location_name ?? null,
      user: user.name,
      isAdmin: user.is_admin,
      entities: states.length,
      areas: registries.areas.length,
      devices: registries.devices.length,
      automations: count('automation'),
      scripts: count('script'),
      scenes: count('scene'),
      pendingUpdates: updates.filter((item) => item.pending).length,
      updates: updates.filter((item) => item.pending || item.inProgress),
    };
  } catch (error) {
    throw toHttpError(error);
  }
}
