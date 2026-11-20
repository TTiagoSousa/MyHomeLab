import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { AppRelease, cleanVersion } from 'src/integrations/releases';

// O Infisical (gestor de segredos, instalado em casa). Entra-se com uma Machine Identity por
// Universal Auth: POST /api/v1/auth/universal-auth/login {clientId, clientSecret} devolve um
// accessToken (Bearer) que expira (expiresIn segundos): guarda-se e volta-se a entrar quando
// expira ou quando o Infisical diz 401. A identidade só vê os projetos onde foi acrescentada
// (Projeto → Access Control → Machine Identities), com o papel que lá tiver.
// Os segredos: /api/v4/secrets (projectId); as versões mais antigas só têm /api/v3/secrets/raw
// (workspaceId), usado quando a rota nova não existe. As pastas: /api/v2/folders (ou /api/v1).
// O Infisical não diz a versão instalada pela API: só /api/v1/admin/config diz
// latestAvailableVersion quando há uma mais recente do que a instalada.
// O MCP oficial é um programa npm à parte (stdio): não se usa; ficam as infisical_*.

export const INFISICAL_REPOSITORY = 'Infisical/infisical';

/** Tira o que se cola a mais: espaços, a barra do fim e o caminho de uma página do Infisical. */
export const normalizeInfisicalUrl = (url: string) =>
  url
    .trim()
    .replace(/\/+$/, '')
    .replace(
      /\/(api|org|organization|organizations|projects|project|login|signup|admin|secret-manager)(\/.*)?$/i,
      '',
    );

/** "infisical/v0.93.1-postgres" ou "v0.167.13" → "0.167.13"; null se for doutro produto. */
export function infisicalTagVersion(tag: string): string | null {
  const match = /^(?:infisical\/)?v?(\d+\.\d+\.\d+)(?:-postgres)?$/i.exec(
    tag.trim(),
  );
  return match ? cleanVersion(match[1]) : null;
}

/**
 * A release mais recente da plataforma no GitHub. O repositório também publica releases da
 * CLI, do operador do Kubernetes, etc. (com outro prefixo): ficam de fora.
 */
export async function latestInfisicalRelease(): Promise<AppRelease | null> {
  const response = await fetch(
    `https://api.github.com/repos/${INFISICAL_REPOSITORY}/releases?per_page=30`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'MyHomeLab',
      },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) throw new Error(`O GitHub respondeu ${response.status}`);
  const releases = (await response.json()) as {
    tag_name: string;
    html_url: string;
    prerelease: boolean;
    draft: boolean;
  }[];
  for (const release of releases) {
    if (release.prerelease || release.draft) continue;
    const version = infisicalTagVersion(release.tag_name);
    if (version) return { version, url: release.html_url };
  }
  return null;
}

export interface InfisicalEnvironment {
  id: string;
  name: string;
  slug: string;
}

export interface InfisicalProject {
  id: string;
  name: string;
  slug?: string;
  type?: string;
  description?: string | null;
  environments: InfisicalEnvironment[];
}

export interface InfisicalSecret {
  id: string;
  secretKey: string;
  secretValue?: string;
  secretValueHidden?: boolean;
  secretComment?: string;
  secretPath?: string;
  environment?: string;
  type?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  tags?: { slug?: string; name?: string }[];
}

export interface InfisicalImport {
  secretPath: string;
  environment: string;
  secrets: InfisicalSecret[];
}

export interface InfisicalFolder {
  id: string;
  name: string;
  description?: string | null;
  relativePath?: string;
  path?: string;
}

export interface InfisicalStatus {
  date?: string;
  message?: string;
  emailConfigured?: boolean;
  redisConfigured?: boolean;
  secretScanningConfigured?: boolean;
}

/** Onde fica um segredo: o projeto, o ambiente (slug) e a pasta ("/" por omissão). */
export interface InfisicalLocation {
  projectId: string;
  environment: string;
  secretPath?: string;
}

/** O Fastify diz "Route GET:/api/v4/secrets not found" quando a rota não existe nesta versão. */
class MissingRouteError extends Error {}

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
      `Não foi possível falar com o Infisical (${what}): ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    /* fica vazio */
  }
  if (!response.ok) {
    const message =
      typeof body.message === 'string' ? body.message : text.slice(0, 300);
    if (response.status === 404 && /^Route .+ not found/i.test(message)) {
      throw new MissingRouteError(message);
    }
    if (response.status === 401) {
      throw new AppIntegrationError(
        'APP_AUTH_FAILED',
        'O Infisical recusou a Machine Identity (o client secret foi revogado, expirou ou esgotou os usos, ou o IP não está na lista permitida). Cria outro client secret em Organização → Access Control → Identities → Universal Auth.',
      );
    }
    if (response.status === 403) {
      throw new Error(
        `a identidade não tem permissão para isto (${what}): acrescenta-a ao projeto (Access Control → Machine Identities) com um papel que deixe. ${message}`,
      );
    }
    if (response.status === 429) {
      throw new Error(
        'o Infisical está a limitar os pedidos: espera um bocado e tenta outra vez',
      );
    }
    throw new Error(
      response.status === 404
        ? `o Infisical não encontrou isso (${what}): ${message}`
        : `o Infisical respondeu ${response.status} (${what}): ${message}`,
    );
  }
  return body as T;
}

/** O estado da instância (sem token). */
export function infisicalStatus(baseUrl: string) {
  return request<InfisicalStatus>(
    `${normalizeInfisicalUrl(baseUrl)}/api/status`,
    {},
    'o estado',
  );
}

/** A configuração pública: diz a versão nova quando há (sem token). */
export async function infisicalUpdate(baseUrl: string) {
  try {
    const body = await request<{
      config?: {
        latestAvailableVersion?: string | null;
        initialized?: boolean;
      };
    }>(
      `${normalizeInfisicalUrl(baseUrl)}/api/v1/admin/config`,
      {},
      'a configuração',
    );
    return body.config?.latestAvailableVersion ?? null;
  } catch {
    return null;
  }
}

/** Os tokens das identidades, por endereço e client id. */
const tokens = new Map<string, { token: string; until: number }>();

/** Só para os testes: esquece os tokens guardados. */
export function forgetInfisicalTokens() {
  tokens.clear();
}

async function universalAuthLogin(
  root: string,
  clientId: string,
  clientSecret: string,
) {
  const body = await request<{ accessToken?: string; expiresIn?: number }>(
    `${root}/api/v1/auth/universal-auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret }),
    },
    'entrar com a Machine Identity',
  );
  if (!body.accessToken) {
    throw new Error('o Infisical não devolveu o token de acesso');
  }
  const seconds = Number(body.expiresIn) > 0 ? Number(body.expiresIn) : 3600;
  return {
    token: body.accessToken,
    until: Date.now() + Math.max(seconds - 60, 30) * 1000,
  };
}

const normalizePath = (path?: string) => {
  const clean = (path ?? '/').trim().replace(/\/+$/, '');
  return clean.startsWith('/') ? clean || '/' : `/${clean}`;
};

export function createInfisicalClient(
  baseUrl: string,
  clientId: string,
  clientSecret: string,
) {
  const root = normalizeInfisicalUrl(baseUrl);
  const key = `${root}\n${clientId}`;

  const accessToken = async (fresh = false) => {
    const cached = tokens.get(key);
    if (!fresh && cached && cached.until > Date.now()) return cached.token;
    const entry = await universalAuthLogin(root, clientId, clientSecret);
    tokens.set(key, entry);
    return entry.token;
  };

  const call = async <T>(
    path: string,
    what: string,
    init: { method?: string; body?: unknown } = {},
  ): Promise<T> => {
    const attempt = async (fresh: boolean) =>
      request<T>(
        `${root}/api${path}`,
        {
          method: init.method ?? 'GET',
          headers: {
            Authorization: `Bearer ${await accessToken(fresh)}`,
            ...(init.body !== undefined
              ? { 'Content-Type': 'application/json' }
              : {}),
          },
          body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        },
        what,
      );
    try {
      return await attempt(false);
    } catch (error) {
      if (
        error instanceof AppIntegrationError &&
        error.code === 'APP_AUTH_FAILED'
      ) {
        tokens.delete(key);
        return attempt(true);
      }
      throw error;
    }
  };

  /** Tenta a rota nova; numa versão antiga sem ela, usa a antiga. */
  const either = async <T>(
    modern: () => Promise<T>,
    legacy: () => Promise<T>,
  ): Promise<T> => {
    try {
      return await modern();
    } catch (error) {
      if (error instanceof MissingRouteError) return legacy();
      throw error;
    }
  };

  const query = (values: Record<string, string | boolean | undefined>) =>
    new URLSearchParams(
      Object.entries(values)
        .filter(([, value]) => value !== undefined)
        .map(([name, value]) => [name, String(value)]),
    ).toString();

  const secretBody = (place: InfisicalLocation, extra: object) => ({
    projectId: place.projectId,
    workspaceId: place.projectId,
    environment: place.environment,
    secretPath: normalizePath(place.secretPath),
    type: 'shared',
    ...extra,
  });

  const toProject = (raw: Record<string, unknown>): InfisicalProject => ({
    id:
      typeof raw.id === 'string'
        ? raw.id
        : typeof raw._id === 'string'
          ? raw._id
          : '',
    name: typeof raw.name === 'string' ? raw.name : '',
    slug: typeof raw.slug === 'string' ? raw.slug : undefined,
    type: typeof raw.type === 'string' ? raw.type : undefined,
    description: typeof raw.description === 'string' ? raw.description : null,
    environments: Array.isArray(raw.environments)
      ? (raw.environments as InfisicalEnvironment[]).map((env) => ({
          id: env.id,
          name: env.name,
          slug: env.slug,
        }))
      : [],
  });

  return {
    /** Confirma a identidade (entra de novo). */
    checkLogin: () => accessToken(true),

    /** Os projetos de segredos onde a identidade está. */
    projects: () =>
      either(
        async () => {
          const all: InfisicalProject[] = [];
          for (let offset = 0; offset < 1000; offset += 100) {
            const page = await call<{
              projects?: Record<string, unknown>[];
              totalCount?: number;
            }>(
              `/v1/projects?${query({ type: 'secret-manager', limit: '100', offset: String(offset) })}`,
              'os projetos',
            );
            const items = (page.projects ?? []).map(toProject);
            all.push(...items);
            if (items.length < 100 || all.length >= (page.totalCount ?? 0))
              break;
          }
          return all;
        },
        async () =>
          (
            await call<{ workspaces?: Record<string, unknown>[] }>(
              '/v1/workspace',
              'os projetos',
            )
          ).workspaces?.map(toProject) ?? [],
      ),

    secrets: (
      place: InfisicalLocation,
      options: { values?: boolean; recursive?: boolean; expand?: boolean } = {},
    ) => {
      const common = {
        environment: place.environment,
        secretPath: normalizePath(place.secretPath),
        recursive: options.recursive ?? false,
        expandSecretReferences: options.expand ?? false,
        include_imports: true,
        includeImports: true,
        viewSecretValue: options.values ?? false,
      };
      return either(
        () =>
          call<{ secrets?: InfisicalSecret[]; imports?: InfisicalImport[] }>(
            `/v4/secrets?${query({ projectId: place.projectId, ...common })}`,
            'os segredos',
          ),
        () =>
          call<{ secrets?: InfisicalSecret[]; imports?: InfisicalImport[] }>(
            `/v3/secrets/raw?${query({ workspaceId: place.projectId, ...common })}`,
            'os segredos',
          ),
      ).then((body) => ({
        secrets: body.secrets ?? [],
        imports: body.imports ?? [],
      }));
    },

    secret: (
      name: string,
      place: InfisicalLocation,
      options: { expand?: boolean } = {},
    ) => {
      const common = {
        environment: place.environment,
        secretPath: normalizePath(place.secretPath),
        expandSecretReferences: options.expand ?? false,
        include_imports: true,
        includeImports: true,
        viewSecretValue: true,
      };
      const id = encodeURIComponent(name.trim());
      return either(
        () =>
          call<{ secret: InfisicalSecret }>(
            `/v4/secrets/${id}?${query({ projectId: place.projectId, ...common })}`,
            `o segredo ${name}`,
          ),
        () =>
          call<{ secret: InfisicalSecret }>(
            `/v3/secrets/raw/${id}?${query({ workspaceId: place.projectId, ...common })}`,
            `o segredo ${name}`,
          ),
      ).then((body) => body.secret);
    },

    /** Devolve "approval" quando o ambiente pede aprovação (fica um pedido à espera). */
    createSecret: (
      name: string,
      place: InfisicalLocation,
      input: { value: string; comment?: string },
    ) => {
      const id = encodeURIComponent(name.trim());
      const body = secretBody(place, {
        secretValue: input.value,
        secretComment: input.comment ?? '',
      });
      return either(
        () =>
          call<{ secret?: InfisicalSecret; approval?: unknown }>(
            `/v4/secrets/${id}`,
            `criar ${name}`,
            { method: 'POST', body },
          ),
        () =>
          call<{ secret?: InfisicalSecret; approval?: unknown }>(
            `/v3/secrets/raw/${id}`,
            `criar ${name}`,
            { method: 'POST', body },
          ),
      );
    },

    updateSecret: (
      name: string,
      place: InfisicalLocation,
      input: { value?: string; comment?: string; newName?: string },
    ) => {
      const id = encodeURIComponent(name.trim());
      const body = secretBody(place, {
        ...(input.value !== undefined ? { secretValue: input.value } : {}),
        ...(input.comment !== undefined
          ? { secretComment: input.comment }
          : {}),
        ...(input.newName?.trim()
          ? { newSecretName: input.newName.trim() }
          : {}),
      });
      return either(
        () =>
          call<{ secret?: InfisicalSecret; approval?: unknown }>(
            `/v4/secrets/${id}`,
            `mudar ${name}`,
            { method: 'PATCH', body },
          ),
        () =>
          call<{ secret?: InfisicalSecret; approval?: unknown }>(
            `/v3/secrets/raw/${id}`,
            `mudar ${name}`,
            { method: 'PATCH', body },
          ),
      );
    },

    deleteSecret: (name: string, place: InfisicalLocation) => {
      const id = encodeURIComponent(name.trim());
      const body = secretBody(place, {});
      return either(
        () =>
          call<{ secret?: InfisicalSecret; approval?: unknown }>(
            `/v4/secrets/${id}`,
            `apagar ${name}`,
            { method: 'DELETE', body },
          ),
        () =>
          call<{ secret?: InfisicalSecret; approval?: unknown }>(
            `/v3/secrets/raw/${id}`,
            `apagar ${name}`,
            { method: 'DELETE', body },
          ),
      );
    },

    folders: (
      place: InfisicalLocation,
      options: { recursive?: boolean } = {},
    ) => {
      const common = {
        environment: place.environment,
        path: normalizePath(place.secretPath),
        recursive: options.recursive ?? false,
      };
      return either(
        () =>
          call<{ folders?: InfisicalFolder[] }>(
            `/v2/folders?${query({ projectId: place.projectId, ...common })}`,
            'as pastas',
          ),
        () =>
          call<{ folders?: InfisicalFolder[] }>(
            `/v1/folders?${query({ workspaceId: place.projectId, ...common })}`,
            'as pastas',
          ),
      ).then((body) => body.folders ?? []);
    },

    createFolder: (
      place: InfisicalLocation,
      input: { name: string; description?: string },
    ) => {
      const body = {
        projectId: place.projectId,
        workspaceId: place.projectId,
        environment: place.environment,
        path: normalizePath(place.secretPath),
        name: input.name.trim(),
        ...(input.description ? { description: input.description } : {}),
      };
      return either(
        () =>
          call<{ folder?: InfisicalFolder }>('/v2/folders', 'criar a pasta', {
            method: 'POST',
            body,
          }),
        () =>
          call<{ folder?: InfisicalFolder }>('/v1/folders', 'criar a pasta', {
            method: 'POST',
            body,
          }),
      ).then((result) => result.folder);
    },
  };
}

export type InfisicalClient = ReturnType<typeof createInfisicalClient>;
