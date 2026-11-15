import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { toHttpError } from 'src/integrations/app-integration.error';
import {
  createTrekAdminClient,
  fetchTrekAppConfig,
} from 'src/trek/trek.client';
import { findConnectedAccount } from './findConnectedAccount';
import { trekMcpOf, trekMcpTools } from 'src/trek/trekMcp.client';
import { ConnectedAccount } from 'src/generated/prisma/client/client';

/** O MCP: se há cliente máquina, quantas ferramentas dá, ou o erro (sem estragar o resto). */
async function mcpState(account: ConnectedAccount) {
  const credentials = trekMcpOf(account);
  if (!credentials) return { configured: false, tools: 0, error: null };
  try {
    const tools = await trekMcpTools(credentials);
    return { configured: true, tools: tools.length, error: null };
  } catch (error) {
    return {
      configured: true,
      tools: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * O estado do TREK, visto agora: a configuração pública (versão, registo aberto,
 * formas de entrar) e, com o login de admin, os backups que o próprio TREK tem.
 * O registo aberto fica à vista: num TREK exposto, qualquer pessoa cria conta.
 */
export async function refreshTrekAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.TREK) {
    throw new BadRequestException('Esta conta não é um TREK');
  }
  if (!account.baseUrl || !account.username || !account.appPassword) {
    throw new BadRequestException(
      'O TREK já não tem a password guardada. Liga-o outra vez.',
    );
  }
  try {
    const config = await fetchTrekAppConfig(account.baseUrl);
    const backups = await createTrekAdminClient(
      account.baseUrl,
      account.username,
      account.appPassword,
    ).listBackups();
    return {
      account,
      registrationOpen: Boolean(
        config.allow_registration &&
        (config.password_registration || config.oidc_registration),
      ),
      requireMfa: Boolean(config.require_mfa),
      login: {
        password: Boolean(config.password_login),
        oidc: Boolean(config.oidc_login && config.oidc_configured),
        passkey: Boolean(config.passkey_configured),
      },
      trekBackups: backups.length,
      mcp: await mcpState(account),
    };
  } catch (error) {
    throw toHttpError(error);
  }
}
