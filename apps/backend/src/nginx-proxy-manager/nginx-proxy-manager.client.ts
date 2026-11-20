import { AppIntegrationError } from 'src/integrations/app-integration.error';

// O Nginx Proxy Manager: a API JSON em <endereço>/api/… (o mesmo endereço do painel, muitas
// vezes http://<ip>:81). Não tem tokens de API: entra-se com o email e a password de um
// utilizador (POST /api/tokens {identity, secret}) e recebe-se um JWT que expira (1 dia por
// omissão; GET /api/tokens dá um novo enquanto o atual vale). Com a verificação em dois passos
// ligada não dá para entrar sem o código: usa um utilizador próprio para o MyHomeLab.
// GET /api/ (sem login) diz a versão. Não há MCP: ficam as nginx_proxy_manager_*.

export const NGINX_PROXY_MANAGER_REPOSITORY =
  'NginxProxyManager/nginx-proxy-manager';

/** O endereço como se copia do browser → a raiz do painel (aceita http e sem protocolo). */
export const normalizeNginxProxyManagerUrl = (url: string) => {
  const trimmed = url.trim();
  const withProtocol = /^[a-z]+:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    const path = parsed.pathname
      .replace(
        /\/(api|login|nginx|certificates|access|users|audit-log|settings)(\/.*)?$/i,
        '',
      )
      .replace(/\/+$/, '');
    return `${parsed.origin}${path}`;
  } catch {
    return withProtocol.replace(/[#?].*$/, '').replace(/\/+$/, '');
  }
};

export type NginxHostKind =
  'proxy-hosts' | 'redirection-hosts' | 'dead-hosts' | 'streams';

export interface NginxMeta {
  nginx_online?: boolean;
  nginx_err?: string | null;
  [key: string]: unknown;
}

export interface NginxCertificate {
  id: number;
  provider: string;
  nice_name?: string;
  domain_names: string[];
  expires_on?: string | null;
  created_on?: string;
  meta?: Record<string, unknown>;
}

export interface NginxAccessList {
  id: number;
  name: string;
  satisfy_any?: boolean;
  pass_auth?: boolean;
  proxy_host_count?: number;
  items?: { username?: string; password?: string; hint?: string }[];
  clients?: { address: string; directive: string }[];
}

export interface NginxProxyHost {
  id: number;
  domain_names: string[];
  forward_scheme: string;
  forward_host: string;
  forward_port: number;
  certificate_id: number | string;
  access_list_id: number;
  ssl_forced: boolean;
  hsts_enabled: boolean;
  hsts_subdomains: boolean;
  http2_support: boolean;
  block_exploits: boolean;
  caching_enabled: boolean;
  allow_websocket_upgrade: boolean;
  advanced_config: string;
  enabled: boolean | number;
  locations?: unknown[];
  meta?: NginxMeta;
  certificate?: NginxCertificate | null;
  access_list?: NginxAccessList | null;
  created_on?: string;
  modified_on?: string;
}

export interface NginxRedirectionHost {
  id: number;
  domain_names: string[];
  forward_scheme: string;
  forward_domain_name: string;
  forward_http_code: number;
  preserve_path: boolean;
  certificate_id: number | string;
  enabled: boolean | number;
  meta?: NginxMeta;
}

export interface NginxDeadHost {
  id: number;
  domain_names: string[];
  certificate_id: number | string;
  enabled: boolean | number;
  meta?: NginxMeta;
}

export interface NginxStream {
  id: number;
  incoming_port: number;
  forwarding_host: string;
  forwarding_port: number;
  tcp_forwarding: boolean;
  udp_forwarding: boolean;
  enabled: boolean | number;
  meta?: NginxMeta;
}

export interface NginxAuditEntry {
  id: number;
  created_on: string;
  object_type: string;
  object_id: number;
  action: string;
  meta?: Record<string, unknown>;
  user?: { name?: string; email?: string };
}

/** Os campos que a API aceita ao criar ou mudar um proxy host (não aceita outros). */
export type NginxProxyHostInput = Partial<{
  domain_names: string[];
  forward_scheme: 'http' | 'https';
  forward_host: string;
  forward_port: number;
  certificate_id: number;
  access_list_id: number;
  ssl_forced: boolean;
  hsts_enabled: boolean;
  hsts_subdomains: boolean;
  http2_support: boolean;
  block_exploits: boolean;
  caching_enabled: boolean;
  allow_websocket_upgrade: boolean;
  advanced_config: string;
  enabled: boolean;
}>;

async function request<T>(
  url: string,
  init: RequestInit,
  what: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new AppIntegrationError(
      'APP_UNREACHABLE',
      `Não foi possível falar com o Nginx Proxy Manager (${what}): ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const text = await response.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = text;
  }
  if (!response.ok) {
    const error =
      body && typeof body === 'object'
        ? (body as { error?: { message?: string } }).error
        : undefined;
    const message =
      error?.message ?? (typeof body === 'string' ? body.slice(0, 300) : '');
    if (response.status === 401) {
      throw new AppIntegrationError(
        'APP_AUTH_FAILED',
        `O Nginx Proxy Manager recusou o login${message ? ` (${message})` : ''}. Confirma o email e a password do utilizador.`,
      );
    }
    if (response.status === 403) {
      throw new Error(
        `o utilizador do Nginx Proxy Manager não tem permissão para isto (${what}): dá-lhe a permissão em Users ou usa um administrador`,
      );
    }
    if (response.status === 429) {
      throw new Error(
        'o Nginx Proxy Manager está a travar os logins (demasiadas tentativas): espera um minuto',
      );
    }
    throw new Error(
      response.status === 404
        ? `o Nginx Proxy Manager não encontrou isso (${what})`
        : `o Nginx Proxy Manager respondeu ${response.status} (${what}): ${message}`,
    );
  }
  return body as T;
}

/** O estado (sem login): "OK", se já foi configurado e a versão. */
export function nginxProxyManagerHealth(baseUrl: string) {
  return request<{
    status?: string;
    setup?: boolean;
    version?: { major: number; minor: number; revision: number };
  }>(`${normalizeNginxProxyManagerUrl(baseUrl)}/api/`, {}, 'o estado');
}

/** A versão instalada, para as atualizações ("v2.17.1"). */
export async function nginxProxyManagerVersion(baseUrl: string) {
  const { status, version } = await nginxProxyManagerHealth(baseUrl);
  if (!status || !version) {
    throw new Error(
      'este endereço não é um Nginx Proxy Manager (não diz a versão)',
    );
  }
  return `v${version.major}.${version.minor}.${version.revision}`;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

/** Os JWT em memória, por endereço e utilizador, para não fazer login a cada pedido. */
const tokens = new Map<string, CachedToken>();

const parseExpiry = (expires?: string) => {
  const time = expires ? Date.parse(expires) : NaN;
  return Number.isNaN(time) ? Date.now() + 60 * 60 * 1000 : time;
};

export function createNginxProxyManagerClient(
  baseUrl: string,
  email: string,
  password: string,
) {
  const root = normalizeNginxProxyManagerUrl(baseUrl);
  const cacheKey = `${root}|${email.trim().toLowerCase()}`;

  const login = async () => {
    const body = await request<{
      token?: string;
      expires?: string;
      requires_2fa?: boolean;
    }>(
      `${root}/api/tokens`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: email.trim(), secret: password }),
      },
      'o login',
    );
    if (body.requires_2fa || !body.token) {
      throw new AppIntegrationError(
        'APP_AUTH_FAILED',
        'Este utilizador do Nginx Proxy Manager tem a verificação em dois passos ligada e o MyHomeLab não tem o código. Cria um utilizador só para o MyHomeLab, sem 2FA.',
      );
    }
    const cached = { token: body.token, expiresAt: parseExpiry(body.expires) };
    tokens.set(cacheKey, cached);
    return cached.token;
  };

  const token = async () => {
    const cached = tokens.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt - now > 10 * 60 * 1000) return cached.token;
    if (cached && cached.expiresAt > now) {
      try {
        const fresh = await request<{ token?: string; expires?: string }>(
          `${root}/api/tokens`,
          { headers: { Authorization: `Bearer ${cached.token}` } },
          'renovar o login',
        );
        if (fresh.token) {
          tokens.set(cacheKey, {
            token: fresh.token,
            expiresAt: parseExpiry(fresh.expires),
          });
          return fresh.token;
        }
      } catch {
        /* faz login outra vez */
      }
    }
    return login();
  };

  const call = async <T>(
    path: string,
    what: string,
    init: { method?: string; body?: unknown } = {},
    retry = true,
  ): Promise<T> => {
    const jwt = await token();
    try {
      return await request<T>(
        `${root}/api${path}`,
        {
          method: init.method ?? 'GET',
          headers: {
            Authorization: `Bearer ${jwt}`,
            ...(init.body !== undefined
              ? { 'Content-Type': 'application/json' }
              : {}),
          },
          body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        },
        what,
      );
    } catch (error) {
      if (
        retry &&
        error instanceof AppIntegrationError &&
        error.code === 'APP_AUTH_FAILED'
      ) {
        tokens.delete(cacheKey);
        return call<T>(path, what, init, false);
      }
      throw error;
    }
  };

  const host = (kind: NginxHostKind, id: number) =>
    `/nginx/${kind}/${encodeURIComponent(String(id))}`;

  return {
    /** Confirma o login e devolve o utilizador. */
    me: () =>
      call<{ id: number; name: string; email: string; roles?: string[] }>(
        '/users/me',
        'o utilizador',
      ),
    proxyHosts: () =>
      call<NginxProxyHost[]>(
        '/nginx/proxy-hosts?expand=certificate,access_list',
        'os proxy hosts',
      ),
    proxyHost: (id: number) =>
      call<NginxProxyHost>(
        `${host('proxy-hosts', id)}?expand=certificate,access_list`,
        `o proxy host ${id}`,
      ),
    createProxyHost: (input: NginxProxyHostInput) =>
      call<NginxProxyHost>('/nginx/proxy-hosts', 'criar o proxy host', {
        method: 'POST',
        body: input,
      }),
    updateProxyHost: (id: number, input: NginxProxyHostInput) =>
      call<NginxProxyHost>(host('proxy-hosts', id), 'mudar o proxy host', {
        method: 'PUT',
        body: input,
      }),
    deleteProxyHost: (id: number) =>
      call<boolean>(host('proxy-hosts', id), 'apagar o proxy host', {
        method: 'DELETE',
      }),
    setEnabled: (kind: NginxHostKind, id: number, enabled: boolean) =>
      call<boolean>(
        `${host(kind, id)}/${enabled ? 'enable' : 'disable'}`,
        enabled ? 'ligar' : 'desligar',
        { method: 'POST', body: {} },
      ),
    redirectionHosts: () =>
      call<NginxRedirectionHost[]>(
        '/nginx/redirection-hosts?expand=certificate',
        'os redirecionamentos',
      ),
    deadHosts: () => call<NginxDeadHost[]>('/nginx/dead-hosts', 'os hosts 404'),
    streams: () => call<NginxStream[]>('/nginx/streams', 'os streams'),
    accessLists: () =>
      call<NginxAccessList[]>(
        '/nginx/access-lists?expand=items,clients',
        'as listas de acesso',
      ),
    certificates: () =>
      call<NginxCertificate[]>('/nginx/certificates', 'os certificados'),
    renewCertificate: (id: number) =>
      call<NginxCertificate>(
        `/nginx/certificates/${encodeURIComponent(String(id))}/renew`,
        'renovar o certificado',
        { method: 'POST', body: {} },
      ),
    auditLog: () =>
      call<NginxAuditEntry[]>(
        '/audit-log?expand=user',
        'o registo de alterações',
      ),
    settings: () =>
      call<{ id: string; name?: string; value: unknown; meta?: unknown }[]>(
        '/settings',
        'as definições',
      ),
  };
}

export type NginxProxyManagerClient = ReturnType<
  typeof createNginxProxyManagerClient
>;

/** Esquece o login guardado (ex.: ao trocar a password). */
export function forgetNginxProxyManagerToken(baseUrl: string, email: string) {
  tokens.delete(
    `${normalizeNginxProxyManagerUrl(baseUrl)}|${email.trim().toLowerCase()}`,
  );
}
