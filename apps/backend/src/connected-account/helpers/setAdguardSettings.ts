import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { toHttpError } from 'src/integrations/app-integration.error';
import { SetAdguardSettingsDto } from '../dto/set-adguard-settings.dto';
import { adguardClientFor } from './adguardClientFor';

/** Guarda as definições manuais no próprio AdGuard: o intervalo das listas (a filtragem fica como estava). */
export async function setAdguardSettings(
  id: string,
  userId: string,
  dto: SetAdguardSettingsDto,
  repository: PrismaConnectedAccountRepository,
) {
  const { client } = await adguardClientFor(id, userId, repository);
  try {
    const filtering = await client.filteringStatus();
    await client.setFilteringConfig(filtering.enabled, dto.filtersInterval);
    return { filtersInterval: dto.filtersInterval };
  } catch (error) {
    throw toHttpError(error);
  }
}
