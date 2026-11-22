import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import {
  ADGUARD_FILTER_INTERVALS,
  AdguardApi,
  AdguardFilter,
  BLOCKED_REASONS,
  adguardStatsPeriod,
  createAdguardClient,
} from 'src/adguard/adguard.client';

const normalize = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const accountLabel = (account: ConnectedAccount) =>
  `${account.displayName ?? 'AdGuard'} (${account.baseUrl ? new URL(account.baseUrl).host : '?'})`;

const percent = (part: number, total: number) =>
  total ? `${((part / total) * 100).toFixed(1)}%` : '0%';

/** [{ "a.com": 3 }, { "b.com": 1 }] → "a.com 3, b.com 1" */
const topList = (entries: Record<string, number>[] | undefined, max = 10) =>
  (entries ?? [])
    .slice(0, max)
    .map((entry) => Object.entries(entry)[0])
    .filter(Boolean)
    .map(([name, count]) => `${name} ${count}`)
    .join(', ') || 'nada';

/** "ads.exemplo.com" (ou um URL) → o domínio limpo. */
const cleanDomain = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/[/:].*$/, '')
    .replace(/^\*\./, '');

const isComment = (rule: string) =>
  !rule.trim() || rule.trim().startsWith('!') || rule.trim().startsWith('#');

export interface AdguardTarget {
  account: ConnectedAccount;
  client: AdguardApi;
}

/**
 * O AdGuard a usar: o único, ou o que bate com o nome ou o endereço que o
 * agente passou. Devolve uma frase para o agente quando não dá.
 */
export async function adguardTarget(
  repository: PrismaConnectedAccountRepository,
  userId: string,
  wanted?: string,
): Promise<AdguardTarget | string> {
  const accounts = (
    await repository.findAllByUser(userId, ConnectionProvider.ADGUARD)
  ).filter(
    (account) =>
      account.isActive &&
      account.baseUrl &&
      account.username &&
      account.appPassword,
  );
  if (!accounts.length) {
    return 'Não há nenhum AdGuard ligado. Liga-o em Apps ligadas → AdGuard.';
  }
  const matches = wanted?.trim()
    ? accounts.filter((account) =>
        normalize(accountLabel(account)).includes(normalize(wanted)),
      )
    : accounts;
  if (matches.length !== 1) {
    return `Diz qual o AdGuard: ${accounts.map(accountLabel).join(', ')}.`;
  }
  const account = matches[0];
  return {
    account,
    client: createAdguardClient(
      account.baseUrl!,
      account.username!,
      account.appPassword!,
    ),
  };
}

const filterLine = (filter: AdguardFilter) =>
  `- [${filter.enabled ? 'ligada' : 'desligada'}] ${filter.name} — ${filter.rules_count} regras, atualizada ${filter.last_updated ? new Date(filter.last_updated).toLocaleString('pt-PT') : 'nunca'} · ${filter.url}`;

export async function overview(target: AdguardTarget): Promise<string> {
  const [status, stats, filtering, statsHours] = await Promise.all([
    target.client.status(),
    target.client.stats(),
    target.client.filteringStatus(),
    target.client.statsHours(),
  ]);
  const filters = filtering.filters ?? [];
  const paused = status.protection_disabled_duration
    ? ` (pausada; volta daqui a ${Math.ceil(status.protection_disabled_duration / 60_000)} min)`
    : '';
  return [
    `${accountLabel(target.account)} — versão ${status.version}, ${status.running ? 'a correr' : 'PARADO'}.`,
    `Proteção: ${status.protection_enabled ? 'ligada' : `DESLIGADA${paused}`}. Filtragem: ${filtering.enabled ? 'ligada' : 'desligada'}, ${filtering.interval ? `listas atualizadas de ${filtering.interval} em ${filtering.interval} h` : 'listas sem atualização automática'}.`,
    `${adguardStatsPeriod(statsHours)}: ${stats.num_dns_queries} pedidos, ${stats.num_blocked_filtering} bloqueados (${percent(stats.num_blocked_filtering, stats.num_dns_queries)}), tempo médio ${stats.avg_processing_time ? `${(stats.avg_processing_time * 1000).toFixed(1)} ms` : '?'}.`,
    `Mais pedidos: ${topList(stats.top_queried_domains)}.`,
    `Mais bloqueados: ${topList(stats.top_blocked_domains)}.`,
    `Clientes mais ativos: ${topList(stats.top_clients)}.`,
    `Listas: ${filters.filter((filter) => filter.enabled).length} de ${filters.length} ligadas, ${(filtering.whitelist_filters ?? []).length} de permissão, ${(filtering.user_rules ?? []).filter((rule) => !isComment(rule)).length} regras próprias.`,
  ].join('\n');
}

export async function queryLog(
  target: AdguardTarget,
  input: {
    search?: string;
    status?: 'all' | 'blocked' | 'processed';
    limit?: number;
  },
): Promise<string> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const response = await target.client.queryLog({
    limit,
    ...(input.search?.trim() ? { search: input.search.trim() } : {}),
    response_status:
      input.status === 'blocked'
        ? 'blocked'
        : input.status === 'processed'
          ? 'processed'
          : 'all',
  });
  const entries = response.data ?? [];
  if (!entries.length) return 'Nenhum pedido encontrado com esse filtro.';
  return [
    `${entries.length} pedidos (os mais recentes primeiro):`,
    ...entries.map((entry) => {
      const blocked = BLOCKED_REASONS.has(entry.reason);
      const rule = entry.rules?.[0]?.text;
      const who = entry.client_info?.name
        ? `${entry.client_info.name} (${entry.client})`
        : entry.client;
      return `- ${new Date(entry.time).toLocaleString('pt-PT')} · ${who} · ${entry.question.name} ${entry.question.type} · ${blocked ? 'BLOQUEADO' : entry.reason === 'Rewrite' || entry.reason === 'RewriteEtcHosts' ? 'reescrito' : entry.reason === 'NotFilteredWhiteList' ? 'permitido por regra' : 'ok'}${rule ? ` [regra: ${rule}]` : ''}`;
    }),
  ].join('\n');
}

export async function checkDomain(
  target: AdguardTarget,
  input: { domain: string },
): Promise<string> {
  const domain = cleanDomain(input.domain);
  const result = await target.client.checkHost(domain);
  const rules = (result.rules ?? []).map((rule) => rule.text).filter(Boolean);
  const verdict = BLOCKED_REASONS.has(result.reason)
    ? 'está BLOQUEADO'
    : result.reason === 'NotFilteredWhiteList'
      ? 'está PERMITIDO por uma regra de permissão'
      : result.reason.startsWith('Rewrite')
        ? `é REESCRITO${result.ip_addrs?.length ? ` para ${result.ip_addrs.join(', ')}` : ''}${result.cname ? ` (CNAME ${result.cname})` : ''}`
        : 'não é filtrado';
  return [
    `${domain} ${verdict} (motivo do AdGuard: ${result.reason}).`,
    result.service_name ? `Serviço bloqueado: ${result.service_name}.` : '',
    rules.length ? `Regras que bateram: ${rules.join(' | ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function listFilters(target: AdguardTarget): Promise<string> {
  const filtering = await target.client.filteringStatus();
  const userRules = filtering.user_rules ?? [];
  return [
    `Listas de bloqueio (${(filtering.filters ?? []).length}):`,
    ...(filtering.filters ?? []).map(filterLine),
    `Listas de permissão (${(filtering.whitelist_filters ?? []).length}):`,
    ...(filtering.whitelist_filters ?? []).map(filterLine),
    `Regras próprias (${userRules.filter((rule) => !isComment(rule)).length}):`,
    ...(userRules.length
      ? userRules.map((rule) => `  ${rule}`)
      : ['  nenhuma']),
  ].join('\n');
}

export async function getSettings(
  target: AdguardTarget,
  input: { section: 'rewrites' | 'clients' | 'blocked_services' },
): Promise<string> {
  if (input.section === 'rewrites') {
    const rewrites = (await target.client.rewrites()) ?? [];
    return rewrites.length
      ? [
          `Reescritas de DNS (${rewrites.length}):`,
          ...rewrites.map(
            (rewrite) => `- ${rewrite.domain} → ${rewrite.answer}`,
          ),
        ].join('\n')
      : 'Não há reescritas de DNS.';
  }
  if (input.section === 'clients') {
    const { clients, auto_clients } = await target.client.clients();
    return [
      `Clientes configurados (${(clients ?? []).length}):`,
      ...(clients ?? []).map(
        (client) =>
          `- ${client.name}: ${client.ids.join(', ')}${client.use_global_settings === false ? ' · definições próprias' : ''}${client.filtering_enabled === false ? ' · SEM filtragem' : ''}${client.use_global_blocked_services === false && client.blocked_services?.length ? ` · serviços bloqueados: ${client.blocked_services.join(', ')}` : ''}`,
      ),
      `Clientes vistos automaticamente (${(auto_clients ?? []).length}):`,
      ...(auto_clients ?? [])
        .slice(0, 100)
        .map(
          (client) =>
            `- ${client.name || '?'} (${client.ip}, ${client.source})`,
        ),
    ].join('\n');
  }
  const [blocked, all] = await Promise.all([
    target.client.blockedServices(),
    target.client.allBlockedServices().catch(() => null),
  ]);
  const names = new Map(
    (all?.blocked_services ?? []).map((service) => [service.id, service.name]),
  );
  return [
    blocked.ids.length
      ? `Serviços bloqueados para toda a rede: ${blocked.ids.map((id) => `${names.get(id) ?? id} [${id}]`).join(', ')}.`
      : 'Nenhum serviço bloqueado para toda a rede.',
    all
      ? `Serviços que se podem bloquear (id): ${all.blocked_services.map((service) => service.id).join(', ')}.`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function setProtection(
  target: AdguardTarget,
  input: { enabled: boolean; minutes?: number },
): Promise<string> {
  const minutes =
    !input.enabled && input.minutes ? Math.max(1, input.minutes) : 0;
  await target.client.setProtection(input.enabled, minutes * 60_000);
  if (input.enabled) return 'Proteção do AdGuard ligada.';
  return minutes
    ? `Proteção do AdGuard pausada durante ${minutes} min; volta sozinha.`
    : 'Proteção do AdGuard DESLIGADA até alguém a voltar a ligar.';
}

/**
 * Bloqueia, permite ou deixa de mexer num domínio através das regras próprias
 * (`||dominio^` e `@@||dominio^`). Devolve as regras de antes para se desfazer.
 */
export async function setDomainRule(
  target: AdguardTarget,
  input: { domain: string; action: 'block' | 'allow' | 'remove' },
): Promise<string> {
  const domain = cleanDomain(input.domain);
  if (!domain) return 'Diz o domínio.';
  const block = `||${domain}^`;
  const allow = `@@||${domain}^`;
  const before = (await target.client.filteringStatus()).user_rules ?? [];
  const rest = before.filter(
    (rule) => rule.trim() !== block && rule.trim() !== allow,
  );
  const after =
    input.action === 'block'
      ? [...rest, block]
      : input.action === 'allow'
        ? [...rest, allow]
        : rest;
  if (
    after.length === before.length &&
    after.every((rule, i) => rule === before[i])
  ) {
    return `Nada a mudar: ${domain} já estava assim.`;
  }
  await target.client.setUserRules(after);
  const done =
    input.action === 'block'
      ? `${domain} passa a estar bloqueado (${block}).`
      : input.action === 'allow'
        ? `${domain} passa a estar sempre permitido (${allow}), mesmo que uma lista o bloqueie.`
        : `Saíram as regras próprias de ${domain}; volta a valer o que as listas disserem.`;
  return `${done}\nRegras próprias antes: ${JSON.stringify(before)}`;
}

/** Substitui as regras próprias todas (sintaxe do AdGuard). Devolve as de antes. */
export async function setUserRules(
  target: AdguardTarget,
  input: { rules: string[] },
): Promise<string> {
  const before = (await target.client.filteringStatus()).user_rules ?? [];
  const rules = input.rules.map((rule) => rule.trimEnd());
  await target.client.setUserRules(rules);
  return `Regras próprias gravadas (${rules.filter((rule) => !isComment(rule)).length}).\nAntes: ${JSON.stringify(before)}`;
}

export async function manageFilter(
  target: AdguardTarget,
  input: {
    action: 'add' | 'remove' | 'enable' | 'disable';
    url: string;
    name?: string;
    allowlist?: boolean;
  },
): Promise<string> {
  const allowlist = Boolean(input.allowlist);
  const url = input.url.trim();
  const kind = allowlist ? 'lista de permissão' : 'lista de bloqueio';
  if (input.action === 'add') {
    await target.client.addFilter(input.name?.trim() || url, url, allowlist);
    return `${kind} adicionada: ${input.name?.trim() || url}. O AdGuard descarregou-a agora.`;
  }
  const filtering = await target.client.filteringStatus();
  const filter = (
    (allowlist ? filtering.whitelist_filters : filtering.filters) ?? []
  ).find((entry) => entry.url === url);
  if (!filter)
    return `Não encontrei uma ${kind} com o URL ${url}. Vê adguard_list_filters.`;
  if (input.action === 'remove') {
    await target.client.removeFilter(url, allowlist);
    return `${kind} removida: ${filter.name} (${url}).`;
  }
  await target.client.setFilter(url, allowlist, {
    name: filter.name,
    url: filter.url,
    enabled: input.action === 'enable',
  });
  return `${kind} ${input.action === 'enable' ? 'ligada' : 'desligada'}: ${filter.name}.`;
}

export async function refreshFilters(
  target: AdguardTarget,
  input: { allowlist?: boolean },
): Promise<string> {
  const result = await target.client.refreshFilters(Boolean(input.allowlist));
  return `Listas ${input.allowlist ? 'de permissão' : 'de bloqueio'} atualizadas: ${result.updated} mudaram.`;
}

/** Muda de quantas em quantas horas o AdGuard descarrega as listas (0 = nunca); a filtragem fica como estava. */
export async function setFilterInterval(
  target: AdguardTarget,
  input: { hours: number },
): Promise<string> {
  const hours = Number(input.hours);
  if (!(ADGUARD_FILTER_INTERVALS as readonly number[]).includes(hours)) {
    return `O AdGuard só aceita ${ADGUARD_FILTER_INTERVALS.join(', ')} horas (0 = nunca).`;
  }
  const filtering = await target.client.filteringStatus();
  if (filtering.interval === hours) {
    return hours
      ? `As listas já se atualizam de ${hours} em ${hours} h.`
      : 'As listas já estavam sem atualização automática.';
  }
  await target.client.setFilteringConfig(filtering.enabled, hours);
  const was = filtering.interval
    ? `de ${filtering.interval} em ${filtering.interval} h`
    : 'nunca';
  return hours
    ? `As listas passam a atualizar-se de ${hours} em ${hours} h (antes: ${was}).`
    : `As listas deixam de se atualizar sozinhas (antes: ${was}). Atualizam-se só com adguard_refresh_filters.`;
}

export async function manageRewrite(
  target: AdguardTarget,
  input: { action: 'add' | 'delete'; domain: string; answer: string },
): Promise<string> {
  const rewrite = {
    domain: input.domain.trim().toLowerCase(),
    answer: input.answer.trim(),
  };
  const existing = (await target.client.rewrites()) ?? [];
  const found = existing.some(
    (entry) =>
      entry.domain === rewrite.domain && entry.answer === rewrite.answer,
  );
  if (input.action === 'add') {
    if (found)
      return `A reescrita ${rewrite.domain} → ${rewrite.answer} já existe.`;
    await target.client.addRewrite(rewrite);
    return `Reescrita criada: ${rewrite.domain} → ${rewrite.answer}.`;
  }
  if (!found) {
    const same = existing.filter((entry) => entry.domain === rewrite.domain);
    return same.length
      ? `Não há ${rewrite.domain} → ${rewrite.answer}; as de ${rewrite.domain} são: ${same.map((entry) => entry.answer).join(', ')}.`
      : `Não há reescritas para ${rewrite.domain}.`;
  }
  await target.client.deleteRewrite(rewrite);
  return `Reescrita apagada: ${rewrite.domain} → ${rewrite.answer}.`;
}

export async function setBlockedServices(
  target: AdguardTarget,
  input: { block?: string[]; unblock?: string[] },
): Promise<string> {
  const current = await target.client.blockedServices();
  const unblock = new Set((input.unblock ?? []).map((id) => id.trim()));
  const ids = [
    ...new Set([
      ...current.ids.filter((id) => !unblock.has(id)),
      ...(input.block ?? []).map((id) => id.trim()).filter(Boolean),
    ]),
  ];
  await target.client.setBlockedServices({ ...current, ids });
  return `Serviços bloqueados para toda a rede: ${ids.join(', ') || 'nenhum'}.\nAntes: ${current.ids.join(', ') || 'nenhum'}.`;
}
