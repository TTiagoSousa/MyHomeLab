import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { describeFetchError } from 'src/integrations/app-fetch';

// O Vaultwarden (servidor compatível com o Bitwarden). Os cofres vêm cifrados de ponta a ponta
// com a password mestra de cada pessoa: o servidor não os sabe ler, e o MyHomeLab também não
// (nunca se pede uma password mestra). O que dá para gerir é o painel de administração
// (<endereço>/admin), com o ADMIN_TOKEN: POST /admin com o formulário "token=…" devolve o cookie
// VW_ADMIN (uma sessão de ADMIN_SESSION_LIFETIME minutos, 20 por omissão), e as rotas JSON do
// painel (/admin/users, /admin/invite, /admin/users/<id>/disable…) aceitam esse cookie.
// O login do painel tem limite (3 tentativas em 5 minutos, por omissão): guarda-se a sessão.
// A versão vem de /api/version (sem token). Não há MCP: ficam as vaultwarden_*.

export const VAULTWARDEN_REPOSITORY = 'dani-garcia/vaultwarden';

/** Tira o que se cola a mais: espaços, a barra do fim, um /admin, /api ou /#/… no fim. */
export const normalizeVaultwardenUrl = (url: string) =>
  url
    .trim()
    .replace(/\/?#.*$/, '')
    .replace(/\/+$/, '')
    .replace(/\/(admin|api|identity)(\/.*)?$/i, '');

/** Como vem um membro de organização dentro de um utilizador (só as confirmadas). */
export interface VaultwardenMembership {
  id: string;
  name: string;
  type?: number;
  status?: number;
}

export interface VaultwardenUser {
  id: string;
  name: string | null;
  email: string;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
  userEnabled?: boolean;
  /** 0 ativo, 1 convidado (ainda sem conta criada). */
  _status?: number;
  createdAt?: string;
  lastActive?: string | null;
  organizations?: VaultwardenMembership[];
}

/** O papel numa organização (como no Bitwarden). */
export const MEMBERSHIP_TYPES: Record<number, string> = {
  0: 'dono',
  1: 'administrador',
  2: 'utilizador',
  3: 'gestor',
  4: 'personalizado',
};

/** As chaves cifradas do utilizador não servem a ninguém fora do cliente: ficam de fora. */
export function sanitizeVaultwardenUser(user: VaultwardenUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified ?? null,
    twoFactorEnabled: user.twoFactorEnabled ?? null,
    enabled: user.userEnabled ?? null,
    invited: user._status === 1,
    createdAt: user.createdAt ?? null,
    lastActive: user.lastActive ?? null,
    organizations: (user.organizations ?? []).map((org) => ({
      id: org.id,
      name: org.name,
      role:
        org.type !== undefined
          ? (MEMBERSHIP_TYPES[org.type] ?? org.type)
          : null,
    })),
  };
}

/** As organizações vistas pelos membros confirmados (o painel só as dá em HTML). */
export function vaultwardenOrganizations(users: VaultwardenUser[]) {
  const byId = new Map<
    string,
    { id: string; name: string; members: number; owners: string[] }
  >();
  for (const user of users) {
    for (const org of user.organizations ?? []) {
      const entry = byId.get(org.id) ?? {
        id: org.id,
        name: org.name,
        members: 0,
        owners: [],
      };
      entry.members += 1;
      if (org.type === 0) entry.owners.push(user.email);
      byId.set(org.id, entry);
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Chaves da configuração que nunca se mostram, mesmo que o Vaultwarden já as mascare
 * (as do tipo password vêm sempre com asteriscos; isto é só uma segunda rede).
 */
const SECRET_KEYS =
  /(token|password|secret|_key$|^push_|private|duo_skey|yubico_secret|database_url)/i;

/** A configuração para mostrar: os segredos ficam "(escondido)". */
export function redactVaultwardenConfig(config: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    result[key] =
      SECRET_KEYS.test(key) && typeof value === 'string' && value !== ''
        ? key === 'database_url'
          ? databaseKind(value)
          : '(escondido)'
        : value;
  }
  return result;
}

/** O tipo de base de dados a partir do database_url mascarado ("postgresql://****" → postgresql). */
export function databaseKind(value: unknown): string {
  const text = typeof value === 'string' ? value : '';
  const scheme = /^([a-z]+):/i.exec(text)?.[1]?.toLowerCase();
  if (scheme === 'postgres' || scheme === 'postgresql') return 'postgresql';
  if (scheme === 'mysql' || scheme === 'mariadb') return 'mysql';
  return 'sqlite';
}

async function send(url: string, init: RequestInit, what: string) {
  try {
    return await fetch(url, {
      redirect: 'manual',
      ...init,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new AppIntegrationError(
      'APP_UNREACHABLE',
      `Não foi possível falar com o Vaultwarden (${what}): ${describeFetchError(error)}`,
    );
  }
}

const errorDetail = (text: string) => {
  try {
    const body = JSON.parse(text) as {
      message?: string;
      errorModel?: { message?: string };
    };
    return body.errorModel?.message || body.message || text.slice(0, 300);
  } catch {
    return text
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 300);
  }
};

/** A versão instalada, para as atualizações ("v1.34.3"). Não pede token. */
export async function vaultwardenVersion(baseUrl: string) {
  const response = await send(
    `${normalizeVaultwardenUrl(baseUrl)}/api/version`,
    { headers: { Accept: 'application/json' } },
    'a versão',
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `o Vaultwarden respondeu ${response.status} (a versão): ${errorDetail(text)}`,
    );
  }
  let version: unknown;
  try {
    version = JSON.parse(text);
  } catch {
    throw new Error('este endereço não é um Vaultwarden (/api/version)');
  }
  if (typeof version !== 'string' || !version.trim()) {
    throw new Error('O Vaultwarden não disse a versão.');
  }
  return `v${version.trim().replace(/^v/i, '')}`;
}

/** As sessões do painel, por endereço e token: o login tem limite de tentativas. */
const SESSION_MS = 15 * 60_000;
const sessions = new Map<string, { cookie: string | null; at: number }>();

/** Só para os testes: esquece as sessões guardadas. */
export function forgetVaultwardenSessions() {
  sessions.clear();
}

function readAdminCookie(response: Response): string | null {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const all =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [response.headers.get('set-cookie') ?? ''];
  for (const line of all) {
    const match = /(?:^|,\s*)VW_ADMIN=([^;]+)/.exec(line);
    if (match) return `VW_ADMIN=${match[1]}`;
  }
  return null;
}

/**
 * Entra no painel com o ADMIN_TOKEN e devolve o cookie. Com DISABLE_ADMIN_TOKEN=true o painel
 * não pede token: aí o login falha, mas as rotas abrem sem cookie (devolve null).
 */
async function login(root: string, token: string): Promise<string | null> {
  const response = await send(
    `${root}/admin`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    },
    'entrar no painel',
  );
  const text = await response.text();
  const cookie = readAdminCookie(response);
  if (cookie) return cookie;
  if (response.status === 429) {
    throw new Error(
      'o Vaultwarden está a limitar as entradas no painel (demasiadas tentativas): espera uns minutos e tenta outra vez',
    );
  }
  if (response.status === 404) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O painel de administração do Vaultwarden está desligado: define o ADMIN_TOKEN no servidor (variável de ambiente) e reinicia-o.',
    );
  }
  if (response.status === 401) {
    const open = await send(
      `${root}/admin/users`,
      { headers: { Accept: 'application/json' } },
      'os utilizadores',
    );
    if (open.ok) return null;
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O Vaultwarden recusou o token de administração. É o ADMIN_TOKEN em texto (o que escreves no /admin), não o hash argon2 guardado no servidor.',
    );
  }
  throw new Error(
    `o Vaultwarden respondeu ${response.status} ao entrar no painel: ${errorDetail(text)}`,
  );
}

export function createVaultwardenClient(baseUrl: string, adminToken: string) {
  const root = normalizeVaultwardenUrl(baseUrl);
  const key = `${root}\n${adminToken}`;

  const session = async (fresh = false) => {
    const cached = sessions.get(key);
    if (!fresh && cached && Date.now() - cached.at < SESSION_MS) {
      return cached.cookie;
    }
    const cookie = await login(root, adminToken);
    sessions.set(key, { cookie, at: Date.now() });
    return cookie;
  };

  const call = async <T>(
    path: string,
    what: string,
    init: { method?: 'GET' | 'POST'; body?: unknown } = {},
  ): Promise<T> => {
    const attempt = async (fresh: boolean) => {
      const cookie = await session(fresh);
      return send(
        `${root}/admin${path}`,
        {
          method: init.method ?? 'GET',
          headers: {
            Accept: 'application/json',
            ...(cookie ? { Cookie: cookie } : {}),
            ...(init.method === 'POST'
              ? { 'Content-Type': 'application/json' }
              : {}),
          },
          body:
            init.method === 'POST'
              ? JSON.stringify(init.body ?? {})
              : undefined,
        },
        what,
      );
    };
    let response = await attempt(false);
    if (response.status === 401) {
      sessions.delete(key);
      response = await attempt(true);
    }
    const text = await response.text();
    if (!response.ok) {
      if (response.status === 401) {
        throw new AppIntegrationError(
          'APP_AUTH_FAILED',
          'O Vaultwarden recusou a sessão do painel de administração (o ADMIN_TOKEN mudou?). Liga-o outra vez com o token novo.',
        );
      }
      const detail = errorDetail(text);
      throw new Error(
        response.status === 404
          ? `o Vaultwarden não encontrou isso (${what})${detail ? `: ${detail}` : ''}`
          : `o Vaultwarden respondeu ${response.status} (${what}): ${detail}`,
      );
    }
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  };

  const user = (id: string) => `/users/${encodeURIComponent(id)}`;

  return {
    /** Confirma o token (entra no painel de novo). */
    checkLogin: () => session(true),
    users: () => call<VaultwardenUser[]>('/users', 'os utilizadores'),
    user: (id: string) => call<VaultwardenUser>(user(id), 'o utilizador'),
    userByEmail: (email: string) =>
      call<VaultwardenUser>(
        `/users/by-mail/${encodeURIComponent(email.trim())}`,
        `o utilizador ${email}`,
      ),
    invite: (email: string) =>
      call<VaultwardenUser>('/invite', `convidar ${email}`, {
        method: 'POST',
        body: { email: email.trim() },
      }),
    resendInvite: (id: string) =>
      call<void>(`${user(id)}/invite/resend`, 'reenviar o convite', {
        method: 'POST',
      }),
    disable: (id: string) =>
      call<void>(`${user(id)}/disable`, 'desativar o utilizador', {
        method: 'POST',
      }),
    enable: (id: string) =>
      call<void>(`${user(id)}/enable`, 'ativar o utilizador', {
        method: 'POST',
      }),
    /** Termina as sessões em todos os dispositivos (apaga os dispositivos). */
    deauth: (id: string) =>
      call<void>(`${user(id)}/deauth`, 'terminar as sessões', {
        method: 'POST',
      }),
    removeTwoFactor: (id: string) =>
      call<void>(`${user(id)}/remove-2fa`, 'tirar o 2FA', { method: 'POST' }),
    deleteUser: (id: string) =>
      call<void>(`${user(id)}/delete`, 'apagar o utilizador', {
        method: 'POST',
      }),
    /** A configuração em vigor, com os segredos já mascarados pelo próprio Vaultwarden. */
    config: () =>
      call<Record<string, unknown>>('/diagnostics/config', 'a configuração'),
    /** Cópia da base de dados SQLite para a pasta data do servidor (só SQLite). */
    backupDatabase: () =>
      call<string>('/config/backup_db', 'a cópia da base de dados', {
        method: 'POST',
      }),
    testSmtp: (email: string) =>
      call<void>('/test/smtp', 'o email de teste', {
        method: 'POST',
        body: { email: email.trim() },
      }),
  };
}

export type VaultwardenClient = ReturnType<typeof createVaultwardenClient>;
