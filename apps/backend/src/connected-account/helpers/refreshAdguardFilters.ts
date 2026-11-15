import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { toHttpError } from 'src/integrations/app-integration.error';
import { adguardClientFor } from './adguardClientFor';

/** Descarrega já as listas de bloqueio do AdGuard; devolve quantas mudaram. */
export async function refreshAdguardFilters(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const { client } = await adguardClientFor(id, userId, repository);
  try {
    return await client.refreshFilters(false);
  } catch (error) {
    throw toHttpError(error);
  }
}
