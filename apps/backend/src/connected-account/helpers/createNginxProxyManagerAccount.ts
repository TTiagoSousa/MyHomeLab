import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { CreateNginxProxyManagerAccountDto } from '../dto/create-nginx-proxy-manager-account.dto';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  createNginxProxyManagerClient,
  forgetNginxProxyManagerToken,
  nginxProxyManagerHealth,
  normalizeNginxProxyManagerUrl,
} from 'src/nginx-proxy-manager/nginx-proxy-manager.client';

/**
 * Liga um Nginx Proxy Manager com o email e a password de um utilizador do painel: confirma
 * que é um NPM (GET /api/), que o login entra e que chega aos proxy hosts. Guarda o email em
 * username e a password cifrada em appPassword (como o AdGuard). O mesmo endereço já ligado fica
 * com o email e a password novos.
 */
export async function createNginxProxyManagerAccount(
  dto: CreateNginxProxyManagerAccountDto,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const baseUrl = normalizeNginxProxyManagerUrl(dto.baseUrl);
  const email = dto.email.trim();
  let user: { name: string; email: string; roles?: string[] };
  try {
    const health = await nginxProxyManagerHealth(baseUrl);
    if (!health.version) {
      throw new Error('este endereço não é um Nginx Proxy Manager');
    }
    if (health.setup === false) {
      throw new Error(
        'o Nginx Proxy Manager ainda não foi configurado: cria primeiro o administrador no painel',
      );
    }
    forgetNginxProxyManagerToken(baseUrl, email);
    const client = createNginxProxyManagerClient(baseUrl, email, dto.password);
    user = await client.me();
    await client.proxyHosts();
  } catch (error) {
    throw new BadRequestException(
      `Não foi possível ligar ao Nginx Proxy Manager: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const isAdmin = (user.roles ?? []).includes('admin');
  const existing = (
    await repository.findAllByUser(
      userId,
      ConnectionProvider.NGINX_PROXY_MANAGER,
    )
  ).find((account) => account.baseUrl === baseUrl);
  if (existing) {
    return repository.update(existing.id, {
      username: email,
      appPassword: dto.password,
      isAdmin,
      isActive: true,
      ...(dto.displayName?.trim()
        ? { displayName: dto.displayName.trim() }
        : {}),
    });
  }
  return repository.create({
    userId,
    provider: ConnectionProvider.NGINX_PROXY_MANAGER,
    displayName: dto.displayName?.trim() || 'Nginx Proxy Manager',
    emailAddress: user.email,
    baseUrl,
    username: email,
    appPassword: dto.password,
    isAdmin,
  });
}
