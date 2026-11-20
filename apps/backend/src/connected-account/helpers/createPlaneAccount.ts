import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { CreatePlaneAccountDto } from '../dto/create-plane-account.dto';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import {
  createPlaneClient,
  normalizePlaneUrl,
  planeInstance,
  planeSlug,
  PlaneUser,
} from 'src/plane/plane.client';

/**
 * Liga um Plane com um token pessoal: confirma que é um Plane (/api/instances/), que o token
 * entra (/users/me/) e que chega ao espaço de trabalho (os projetos). Guarda o token cifrado e,
 * em username, o slug do espaço (cada ligação é um espaço). O mesmo espaço no mesmo endereço
 * fica com o token novo.
 */
export async function createPlaneAccount(
  dto: CreatePlaneAccountDto,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const baseUrl = normalizePlaneUrl(dto.baseUrl);
  const apiKey = dto.apiKey.trim();
  const slug = planeSlug(dto.workspace);
  if (!slug) throw new BadRequestException('Falta o espaço de trabalho.');
  let user: PlaneUser;
  try {
    await planeInstance(baseUrl);
    const client = createPlaneClient(baseUrl, apiKey, slug);
    user = await client.me();
    await client.projects().catch((error: unknown) => {
      throw new Error(
        `o token entra, mas não chega ao espaço «${slug}» (${error instanceof Error ? error.message : String(error)}). O slug é o que vem logo a seguir ao endereço no link do Plane.`,
      );
    });
  } catch (error) {
    throw new BadRequestException(
      `Não foi possível ligar ao Plane: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const existing = (
    await repository.findAllByUser(userId, ConnectionProvider.PLANE)
  ).find((account) => account.baseUrl === baseUrl && account.username === slug);
  if (existing) {
    return repository.update(existing.id, {
      accessToken: apiKey,
      isActive: true,
      ...(dto.displayName?.trim()
        ? { displayName: dto.displayName.trim() }
        : {}),
    });
  }
  return repository.create({
    userId,
    provider: ConnectionProvider.PLANE,
    displayName: dto.displayName?.trim() || slug,
    emailAddress: user.email,
    accessToken: apiKey,
    baseUrl,
    username: slug,
  });
}
