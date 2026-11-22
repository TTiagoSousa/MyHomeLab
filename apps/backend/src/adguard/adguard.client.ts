import { AxiosRequestConfig } from 'axios';
import { createAppHttp } from 'src/integrations/app-http';
import { AppIntegrationError } from 'src/integrations/app-integration.error';

/** O repositório das releases do AdGuard Home. */
export const ADGUARD_REPOSITORY = 'AdguardTeam/AdGuardHome';

/**
 * O endereço tal como se copia do browser → a raiz do painel:
 * "192.168.1.2" → "http://192.168.1.2"; "http://192.168.1.2/#/" ou
 * ".../login.html" → "http://192.168.1.2". Um caminho de proxy (/adguard) fica.
 */
export const normalizeAdguardUrl = (url: string) => {
  const trimmed = url.trim();
  const withProtocol = /^[a-z]+:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    const path = parsed.pathname
      .replace(/\/(login|index)\.html$/i, '')
      .replace(/\/+$/, '');
    return `${parsed.origin}${path}`;
  } catch {
    return withProtocol.replace(/\/+$/, '');
  }
};

export interface AdguardStatus {
  version: string;
  running: boolean;
  protection_enabled: boolean;
  /** Milissegundos até a proteção voltar sozinha (quando foi pausada com tempo). */
  protection_disabled_duration?: number;
  dns_addresses?: string[];
  dns_port?: number;
  http_port?: number;
}

export interface AdguardFilter {
  id: number;
  name: string;
  url: string;
  enabled: boolean;
  rules_count: number;
  last_updated?: string;
}

/** De quantas em quantas horas o AdGuard pode descarregar as listas (0 = nunca), os valores que ele aceita. */
export const ADGUARD_FILTER_INTERVALS = [0, 1, 12, 24, 72, 168] as const;

export interface AdguardFilteringStatus {
  enabled: boolean;
  interval: number;
  filters: AdguardFilter[] | null;
  whitelist_filters: AdguardFilter[] | null;
  user_rules: string[] | null;
}

type TopEntry = Record<string, number>;

export interface AdguardStats {
  time_units?: string;
  num_dns_queries: number;
  num_blocked_filtering: number;
  num_replaced_safebrowsing?: number;
  num_replaced_parental?: number;
  avg_processing_time?: number;
  top_queried_domains?: TopEntry[];
  top_blocked_domains?: TopEntry[];
  top_clients?: TopEntry[];
}

export interface AdguardQueryLogEntry {
  time: string;
  client: string;
  client_info?: { name?: string };
  question: { name: string; type: string };
  reason: string;
  status?: string;
  elapsedMs?: string;
  rules?: { text: string; filter_list_id: number }[];
  answer?: { type: string; value: string }[];
}

export interface AdguardRewrite {
  domain: string;
  answer: string;
}

export interface AdguardClientEntry {
  name: string;
  ids: string[];
  use_global_settings?: boolean;
  filtering_enabled?: boolean;
  use_global_blocked_services?: boolean;
  blocked_services?: string[] | null;
  tags?: string[] | null;
}

export interface AdguardHostCheck {
  reason: string;
  rules?: { text: string; filter_list_id: number }[];
  service_name?: string;
  cname?: string;
  ip_addrs?: string[] | null;
}

export interface AdguardBlockedServices {
  ids: string[];
  schedule?: unknown;
}

/** Os motivos do AdGuard que querem dizer "bloqueado". */
export const BLOCKED_REASONS = new Set([
  'FilteredBlackList',
  'FilteredBlockedService',
  'FilteredSafeBrowsing',
  'FilteredParental',
  'FilteredSafeSearch',
]);

/** "Últimas 24 h", "Últimos 7 dias"… para o período das estatísticas (em horas). */
export function adguardStatsPeriod(hours: number | null): string {
  if (!hours) return 'No período escolhido no AdGuard';
  if (hours === 24) return 'Últimas 24 h';
  if (hours % 24 === 0) return `Últimos ${hours / 24} dias`;
  return `Últimas ${Math.round(hours)} h`;
}

/**
 * A API de controlo do AdGuard Home (`/control/...`), com o utilizador e a
 * password do painel (o AdGuard não tem tokens de API).
 */
export function createAdguardClient(
  baseUrl: string,
  username: string,
  password: string,
) {
  const http = createAppHttp('AdGuard', `${baseUrl}/control`, {
    auth: { username, password },
  });
  // O AdGuard responde 401/403 quando o utilizador ou a password não entram.
  const request = async <T>(path: string, options: AxiosRequestConfig) => {
    try {
      return (await http<T>(path, options)).data;
    } catch (error) {
      if (
        error instanceof AppIntegrationError &&
        error.code === 'APP_AUTH_FAILED'
      ) {
        throw new AppIntegrationError(
          'APP_AUTH_FAILED',
          'O AdGuard recusou o utilizador ou a password.',
        );
      }
      throw error;
    }
  };
  const get = <T>(path: string, params?: Record<string, unknown>) =>
    request<T>(path, { params });
  const send = <T>(
    path: string,
    data?: unknown,
    method: 'post' | 'put' = 'post',
  ) => request<T>(path, { method, data });

  return {
    status: () => get<AdguardStatus>('/status'),
    /** Pausa ou volta a ligar a proteção; `duration` em milissegundos (0 = sem fim). */
    setProtection: (enabled: boolean, duration?: number) =>
      send('/protection', duration ? { enabled, duration } : { enabled }),
    stats: () => get<AdguardStats>('/stats'),
    /**
     * De quantas horas são as estatísticas (o período escolhido no AdGuard). As versões
     * novas dão o intervalo em milissegundos em /stats/config; as antigas, em dias em
     * /stats_info. Sem resposta: null.
     */
    statsHours: () =>
      get<{ interval?: number }>('/stats/config')
        .catch(() => get<{ interval?: number }>('/stats_info'))
        .then(({ interval }) =>
          !interval
            ? null
            : interval > 1000
              ? interval / 3_600_000
              : interval * 24,
        )
        .catch(() => null),
    queryLog: (params: Record<string, unknown>) =>
      get<{ data: AdguardQueryLogEntry[] | null; oldest?: string }>(
        '/querylog',
        params,
      ),
    filteringStatus: () => get<AdguardFilteringStatus>('/filtering/status'),
    /** Liga ou desliga a filtragem e muda de quantas em quantas horas se descarregam as listas. */
    setFilteringConfig: (enabled: boolean, interval: number) =>
      send('/filtering/config', { enabled, interval }),
    refreshFilters: (whitelist: boolean) =>
      send<{ updated: number }>('/filtering/refresh', { whitelist }),
    addFilter: (name: string, url: string, whitelist: boolean) =>
      send('/filtering/add_url', { name, url, whitelist }),
    removeFilter: (url: string, whitelist: boolean) =>
      send('/filtering/remove_url', { url, whitelist }),
    setFilter: (
      url: string,
      whitelist: boolean,
      data: { name: string; url: string; enabled: boolean },
    ) => send('/filtering/set_url', { url, whitelist, data }),
    setUserRules: (rules: string[]) => send('/filtering/set_rules', { rules }),
    checkHost: (name: string) =>
      get<AdguardHostCheck>('/filtering/check_host', { name }),
    rewrites: () => get<AdguardRewrite[] | null>('/rewrite/list'),
    addRewrite: (rewrite: AdguardRewrite) => send('/rewrite/add', rewrite),
    deleteRewrite: (rewrite: AdguardRewrite) =>
      send('/rewrite/delete', rewrite),
    clients: () =>
      get<{
        clients: AdguardClientEntry[] | null;
        auto_clients: { ip: string; name: string; source: string }[] | null;
      }>('/clients'),
    blockedServices: () => get<AdguardBlockedServices>('/blocked_services/get'),
    allBlockedServices: () =>
      get<{ blocked_services: { id: string; name: string }[] }>(
        '/blocked_services/all',
      ),
    setBlockedServices: (value: AdguardBlockedServices) =>
      send('/blocked_services/update', value, 'put'),
    /** Uma leitura qualquer da API de controlo (usado pelos backups). */
    read: <T>(path: string) => get<T>(path),
  };
}

export type AdguardApi = ReturnType<typeof createAdguardClient>;
