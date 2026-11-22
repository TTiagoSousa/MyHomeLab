import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { toHttpError } from 'src/integrations/app-integration.error';
import { adguardClientFor } from './adguardClientFor';

/**
 * O estado do AdGuard, visto agora: se a proteção está ligada, os pedidos e os
 * bloqueados do período das estatísticas (statsHours), as listas (e de quantas em quantas horas se
 * atualizam, e quando foi a última) e as regras próprias.
 */
export async function refreshAdguardAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const { account, client } = await adguardClientFor(id, userId, repository);
  try {
    const [status, stats, filtering, rewrites, statsHours] = await Promise.all([
      client.status(),
      client.stats(),
      client.filteringStatus(),
      client.rewrites(),
      client.statsHours(),
    ]);
    const filters = filtering.filters ?? [];
    return {
      account,
      running: status.running,
      protectionEnabled: status.protection_enabled,
      queries: stats.num_dns_queries,
      blocked: stats.num_blocked_filtering,
      // De quantas horas são os pedidos e os bloqueados (o período do AdGuard).
      statsHours,
      filters: filters.length,
      enabledFilters: filters.filter((filter) => filter.enabled).length,
      rules: filters.reduce(
        (sum, filter) => sum + (filter.enabled ? filter.rules_count : 0),
        0,
      ),
      allowlists: (filtering.whitelist_filters ?? []).length,
      userRules: (filtering.user_rules ?? []).filter(
        (rule) => rule.trim() && !rule.trim().startsWith('!'),
      ).length,
      rewrites: (rewrites ?? []).length,
      filtersInterval: filtering.interval,
      filtersUpdatedAt:
        filters
          .map((filter) => filter.last_updated)
          .filter((date): date is string => Boolean(date))
          .sort()
          .pop() ?? null,
    };
  } catch (error) {
    throw toHttpError(error);
  }
}
