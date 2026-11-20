import { AppIntegrationError } from 'src/integrations/app-integration.error';

// O Coolify (v4, auto-alojamento de apps, serviços e bases de dados): a API REST em
// <endereço>/api/v1/…, com um token de Keys & Tokens → API tokens no cabeçalho
// "Authorization: Bearer". A API tem de estar ligada (Settings → Advanced → API Access) e o
// endereço do MyHomeLab tem de caber nos "Allowed IPs". O que o token pode depende das
// permissões dele: read, read:sensitive (logs e valores das variáveis), write, deploy, delete.
// O próprio Coolify serve um MCP em <endereço>/mcp (Streamable HTTP, o mesmo token), quando
// está ligado na instância e na equipa: ligado diretamente ao agente no Claude Code.

export const COOLIFY_REPOSITORY = 'coollabsio/coolify';

/** Tira o que se cola a mais: espaços, a barra do fim, um /api ou /mcp colado; sem protocolo, http. */
export const normalizeCoolifyUrl = (url: string) => {
  const trimmed = url.trim();
  const withProtocol = /^[a-z]+:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  return withProtocol
    .replace(/[#?].*$/, '')
    .replace(/\/+$/, '')
    .replace(
      /\/(api|mcp|login|dashboard|settings|projects|servers)(\/.*)?$/i,
      '',
    );
};

export type CoolifyKind = 'applications' | 'services' | 'databases';

export interface CoolifyServer {
  uuid: string;
  name: string;
  ip?: string;
  description?: string | null;
  is_reachable?: boolean;
  is_usable?: boolean;
  settings?: { is_reachable?: boolean; is_usable?: boolean };
  proxy?: { type?: string; status?: string } | null;
}

export interface CoolifyEnvironment {
  id?: number;
  uuid?: string;
  name: string;
  description?: string | null;
}

export interface CoolifyProject {
  uuid: string;
  name: string;
  description?: string | null;
  environments?: CoolifyEnvironment[];
}

export interface CoolifyResource {
  uuid: string;
  name: string;
  type?: string;
  status?: string;
  description?: string | null;
  fqdn?: string | null;
  git_repository?: string | null;
  git_branch?: string | null;
  build_pack?: string | null;
  database_type?: string | null;
  service_type?: string | null;
  image?: string | null;
  environment_id?: number;
  destination_id?: number;
  created_at?: string;
  updated_at?: string;
  last_online_at?: string | null;
  [key: string]: unknown;
}

export interface CoolifyDeployment {
  id?: number;
  deployment_uuid: string;
  application_id?: string | number;
  application_name?: string;
  status: string;
  commit?: string | null;
  commit_message?: string | null;
  server_name?: string;
  force_rebuild?: boolean;
  is_webhook?: boolean;
  created_at?: string;
  updated_at?: string;
  finished_at?: string | null;
  logs?: string | null;
  deployment_url?: string;
}

export interface CoolifyEnv {
  uuid: string;
  key: string;
  value?: string | null;
  real_value?: string | null;
  is_preview?: boolean;
  is_literal?: boolean;
  is_shown_once?: boolean;
  is_runtime?: boolean;
  is_buildtime?: boolean;
  comment?: string | null;
}

export interface CoolifyMcpTool {
  name: string;
  description?: string;
  annotations?: { readOnlyHint?: boolean };
}

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
      `Não foi possível falar com o Coolify (${what}): ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    /* fica o texto (ex.: /version responde só "4.7.6") */
  }
  if (!response.ok) {
    const record =
      body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const message =
      typeof record.message === 'string' ? record.message : text.slice(0, 300);
    if (response.status === 401) {
      throw new AppIntegrationError(
        'APP_AUTH_FAILED',
        'O Coolify recusou o token (apagado, expirado ou errado). Cria outro em Keys & Tokens → API tokens.',
      );
    }
    if (response.status === 403 && /api is disabled/i.test(message)) {
      throw new AppIntegrationError(
        'APP_NOT_SUPPORTED',
        'A API do Coolify está desligada. Liga-a em Settings → Advanced → API Access.',
      );
    }
    if (response.status === 403) {
      throw new Error(
        /ip/i.test(message)
          ? `o Coolify não aceita pedidos deste endereço (Settings → Advanced → Allowed IPs): ${message}`
          : `o token do Coolify não tem permissão para isto (${what}): ${message}. Dá-lhe a permissão em Keys & Tokens (read, read:sensitive, write, deploy).`,
      );
    }
    if (response.status === 404) {
      throw new Error(`o Coolify não encontrou isso (${what}): ${message}`);
    }
    const errors =
      record.errors && typeof record.errors === 'object'
        ? ` ${JSON.stringify(record.errors).slice(0, 300)}`
        : '';
    throw new Error(
      `o Coolify respondeu ${response.status} (${what}): ${message}${errors}`,
    );
  }
  return body as T;
}

/** A versão instalada, para as atualizações ("v4.7.6" ou "v4.0.0-beta.420"). */
export async function coolifyVersion(baseUrl: string, token: string) {
  const body = await request<unknown>(
    `${normalizeCoolifyUrl(baseUrl)}/api/v1/version`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    },
    'a versão',
  );
  const version =
    typeof body === 'string'
      ? body
      : typeof body === 'number'
        ? String(body)
        : '';
  if (!version.trim()) throw new Error('O Coolify não disse a versão.');
  return `v${version.trim().replace(/^v/, '')}`;
}

/** As respostas do MCP vêm em JSON ou em Server-Sent Events ("data: {…}"). */
export function parseMcpBody(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const data = text
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean)
      .pop();
    if (!data) return null;
    try {
      return JSON.parse(data) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

export function createCoolifyClient(baseUrl: string, token: string) {
  const root = normalizeCoolifyUrl(baseUrl);
  const call = <T>(
    path: string,
    what: string,
    init: { method?: string; body?: unknown } = {},
  ) =>
    request<T>(
      `${root}/api/v1${path}`,
      {
        method: init.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(init.body !== undefined
            ? { 'Content-Type': 'application/json' }
            : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      },
      what,
    );
  const id = (uuid: string) => encodeURIComponent(uuid);
  const asList = <T>(body: unknown): T[] =>
    Array.isArray(body)
      ? (body as T[])
      : body &&
          typeof body === 'object' &&
          Array.isArray((body as { data?: unknown }).data)
        ? (body as { data: T[] }).data
        : [];

  const mcp = async (method: string, params?: unknown) => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
    const post = (payload: unknown) =>
      fetch(`${root}/mcp`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });
    const init = await post({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'myhomelab', version: '1' },
      },
    });
    if (!init.ok) return null;
    const session = init.headers.get('mcp-session-id');
    if (session) headers['Mcp-Session-Id'] = session;
    await init.text();
    const response = await post({ jsonrpc: '2.0', id: 2, method, params });
    if (!response.ok) return null;
    return parseMcpBody(await response.text());
  };

  return {
    version: () => coolifyVersion(root, token),
    currentTeam: () =>
      call<{ id: number; name: string; description?: string | null }>(
        '/teams/current',
        'a equipa do token',
      ),
    servers: () =>
      call<unknown>('/servers', 'os servidores').then(asList<CoolifyServer>),
    server: (uuid: string) =>
      call<CoolifyServer>(`/servers/${id(uuid)}`, 'o servidor'),
    serverResources: (uuid: string) =>
      call<unknown>(
        `/servers/${id(uuid)}/resources`,
        'os recursos do servidor',
      ).then(asList<CoolifyResource>),
    serverDomains: (uuid: string) =>
      call<unknown>(
        `/servers/${id(uuid)}/domains`,
        'os domínios do servidor',
      ).then(asList<{ ip?: string; domains?: string[] }>),
    projects: () =>
      call<unknown>('/projects', 'os projetos').then(asList<CoolifyProject>),
    project: (uuid: string) =>
      call<CoolifyProject>(`/projects/${id(uuid)}`, 'o projeto'),
    environments: (uuid: string) =>
      call<unknown>(`/projects/${id(uuid)}/environments`, 'os ambientes').then(
        asList<CoolifyEnvironment>,
      ),
    /** Tudo de uma vez: aplicações, serviços e bases de dados, com o tipo e o estado. */
    resources: () =>
      call<unknown>('/resources', 'os recursos').then(asList<CoolifyResource>),
    list: (kind: CoolifyKind) =>
      call<unknown>(`/${kind}`, KIND_LABEL[kind]).then(asList<CoolifyResource>),
    get: (kind: CoolifyKind, uuid: string) =>
      call<CoolifyResource>(`/${kind}/${id(uuid)}`, KIND_ONE[kind]),
    /** Arranca o deploy (aplicações; serviços e bases de dados reiniciam). Por uuid ou etiqueta. */
    deploy: (input: { uuids?: string[]; tag?: string; force?: boolean }) => {
      const query = new URLSearchParams();
      if (input.uuids?.length) query.set('uuid', input.uuids.join(','));
      if (input.tag) query.set('tag', input.tag);
      if (input.force) query.set('force', 'true');
      return call<{
        deployments?: {
          message?: string;
          resource_uuid?: string;
          deployment_uuid?: string;
        }[];
        message?: string;
      }>(`/deploy?${query.toString()}`, 'o deploy', {
        method: 'POST',
        body: {},
      });
    },
    action: (
      kind: CoolifyKind,
      uuid: string,
      action: 'start' | 'stop' | 'restart',
    ) =>
      call<{ message?: string; deployment_uuid?: string }>(
        `/${kind}/${id(uuid)}/${action}`,
        action,
        { method: 'POST', body: {} },
      ),
    /** Os deploys a correr agora (em todos os servidores). */
    runningDeployments: () =>
      call<unknown>('/deployments', 'os deploys a correr').then(
        asList<CoolifyDeployment>,
      ),
    applicationDeployments: (uuid: string, take = 10) =>
      call<
        | { count?: number; deployments?: CoolifyDeployment[] }
        | CoolifyDeployment[]
      >(
        `/deployments/applications/${id(uuid)}?skip=0&take=${take}`,
        'os deploys da aplicação',
      ).then((body) => (Array.isArray(body) ? body : (body.deployments ?? []))),
    deployment: (uuid: string) =>
      call<CoolifyDeployment>(`/deployments/${id(uuid)}`, 'o deploy'),
    cancelDeployment: (uuid: string) =>
      call<{ message?: string }>(
        `/deployments/${id(uuid)}/cancel`,
        'cancelar o deploy',
        {
          method: 'POST',
          body: {},
        },
      ),
    logs: (kind: CoolifyKind, uuid: string, lines = 100) =>
      call<{ logs?: unknown }>(
        `/${kind}/${id(uuid)}/logs?lines=${lines}`,
        'os logs',
      ).then((body) =>
        typeof body.logs === 'string'
          ? body.logs
          : JSON.stringify(body.logs ?? body, null, 1),
      ),
    envs: (kind: CoolifyKind, uuid: string) =>
      call<unknown>(`/${kind}/${id(uuid)}/envs`, 'as variáveis').then(
        asList<CoolifyEnv>,
      ),
    /** Muda o valor de uma variável; se ainda não existe, cria-a. */
    setEnv: async (
      kind: CoolifyKind,
      uuid: string,
      input: {
        key: string;
        value: string;
        is_preview?: boolean;
        is_literal?: boolean;
      },
    ) => {
      const existing = (
        await call<unknown>(`/${kind}/${id(uuid)}/envs`, 'as variáveis').then(
          asList<CoolifyEnv>,
        )
      ).find(
        (env) =>
          env.key === input.key &&
          Boolean(env.is_preview) === Boolean(input.is_preview),
      );
      return existing
        ? call<CoolifyEnv>(`/${kind}/${id(uuid)}/envs`, 'mudar a variável', {
            method: 'PATCH',
            body: input,
          }).then(() => 'changed' as const)
        : call<CoolifyEnv>(`/${kind}/${id(uuid)}/envs`, 'criar a variável', {
            method: 'POST',
            body: input,
          }).then(() => 'created' as const);
    },
    /** As ferramentas do MCP do próprio Coolify (null quando está desligado ou não existe). */
    mcpTools: async (): Promise<CoolifyMcpTool[] | null> => {
      try {
        const body = await mcp('tools/list', {});
        const result = body?.result as { tools?: CoolifyMcpTool[] } | undefined;
        return result?.tools?.length ? result.tools : null;
      } catch {
        return null;
      }
    },
    mcpUrl: () => `${root}/mcp`,
  };
}

const KIND_LABEL: Record<CoolifyKind, string> = {
  applications: 'as aplicações',
  services: 'os serviços',
  databases: 'as bases de dados',
};

const KIND_ONE: Record<CoolifyKind, string> = {
  applications: 'a aplicação',
  services: 'o serviço',
  databases: 'a base de dados',
};

export type CoolifyClient = ReturnType<typeof createCoolifyClient>;
