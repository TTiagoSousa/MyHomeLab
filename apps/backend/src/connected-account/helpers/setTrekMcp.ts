import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { toHttpError } from 'src/integrations/app-integration.error';
import {
  forgetTrekMcp,
  trekMcpOf,
  trekMcpTools,
} from 'src/trek/trekMcp.client';
import { SetTrekMcpDto } from '../dto/set-trek-mcp.dto';
import { findConnectedAccount } from './findConnectedAccount';

/**
 * Liga, troca ou tira o cliente máquina do MCP de um TREK. Antes de guardar
 * confirma que entra (lista as ferramentas); os dois campos vazios tiram-no.
 */
export async function setTrekMcp(
  id: string,
  userId: string,
  dto: SetTrekMcpDto,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.TREK || !account.baseUrl) {
    throw new BadRequestException('Esta conta não é um TREK');
  }
  const previous = trekMcpOf(account);
  if (previous) forgetTrekMcp(previous);

  const clientId = dto.clientId?.trim();
  const clientSecret = dto.clientSecret?.trim();
  if (!clientId && !clientSecret) {
    await repository.update(account.id, {
      apiClientId: null,
      apiClientSecret: null,
    });
    return { connected: false, tools: 0 };
  }
  if (!clientId || !clientSecret) {
    throw new BadRequestException(
      'O cliente MCP precisa do client_id e do client_secret.',
    );
  }
  try {
    const tools = await trekMcpTools(
      { baseUrl: account.baseUrl, clientId, clientSecret },
      true,
    );
    await repository.update(account.id, {
      apiClientId: clientId,
      apiClientSecret: clientSecret,
    });
    return { connected: true, tools: tools.length };
  } catch (error) {
    throw toHttpError(error);
  }
}
