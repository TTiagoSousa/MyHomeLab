import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { toHttpError } from 'src/integrations/app-integration.error';
import {
  forgetOpenGymMcp,
  openGymMcpOf,
  openGymMcpTools,
} from 'src/opengym/openGymMcp.client';
import { SetOpenGymMcpDto } from '../dto/set-opengym-mcp.dto';
import { findConnectedAccount } from './findConnectedAccount';

/**
 * Liga, troca ou tira o token de API do MCP de um openGym. Antes de guardar confirma
 * que entra (lista as ferramentas); vazio tira-o. Fica cifrado no apiClientSecret.
 */
export async function setOpenGymMcp(
  id: string,
  userId: string,
  dto: SetOpenGymMcpDto,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.OPENGYM || !account.baseUrl) {
    throw new BadRequestException('Esta conta não é uma conta openGym');
  }
  const previous = openGymMcpOf(account);
  if (previous) forgetOpenGymMcp(previous);

  const token = dto.token?.trim();
  if (!token) {
    await repository.update(account.id, { apiClientSecret: null });
    return { connected: false, tools: 0 };
  }
  try {
    const tools = await openGymMcpTools(
      { baseUrl: account.baseUrl, token },
      true,
    );
    await repository.update(account.id, { apiClientSecret: token });
    return { connected: true, tools: tools.length };
  } catch (error) {
    throw toHttpError(error);
  }
}
