import { AppIntegrationError } from 'src/integrations/app-integration.error';

// O Gitea Mirror (espelha repositórios do GitHub no Gitea/Forgejo): a API JSON em
// <endereço>/api/…, com a chave de API (Configuração → Autenticação → Chaves de API, "gm_…")
// no cabeçalho "x-api-key". Os POST levam sempre Content-Type: application/json (sem isso
// responde 403). /api/health não pede chave e diz a versão. Desde a v3.46 há um MCP no próprio
// servidor (POST /api/mcp, só com a chave): ligado diretamente ao agente no Claude Code.

export const GITEA_MIRROR_REPOSITORY = 'RayLabsHQ/gitea-mirror';

export const normalizeGiteaMirrorUrl = (url: string) =>
  url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api(\/.*)?$/i, '');

export interface GiteaMirrorHealth {
  status: string;
  version?: string;
  latestVersion?: string;
  updateAvailable?: boolean;
  database?: { connected?: boolean };
}

export interface GiteaMirrorRepository {
  id: string;
  name: string;
  fullName: string;
  owner: string;
  status: string;
  mirroredLocation?: string | null;
  lastMirrored?: string | null;
  destinationOrg?: string | null;
  sourceProvider?: string;
  isPrivate?: boolean;
  errorMessage?: string | null;
}

export interface GiteaMirrorOrganization {
  id: string;
  name: string;
  status: string;
  repositoryCount?: number;
  publicRepositoryCount?: number;
  privateRepositoryCount?: number;
}

export interface GiteaMirrorActivity {
  id: string;
  repositoryName?: string | null;
  organizationName?: string | null;
  status: string;
  message?: string;
  details?: string | null;
  timestamp: string;
  jobType?: string;
  inProgress?: boolean;
}

export type GiteaMirrorJob = 'mirror-repo' | 'sync-repo' | 'retry-repo';

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
      `Não foi possível falar com o Gitea Mirror (${what}): ${error instanceof Error ? error.message : String(error)}`,
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
    if (response.status === 401) {
      throw new AppIntegrationError(
        'APP_AUTH_FAILED',
        'O Gitea Mirror recusou a chave de API (apagada, expirada ou errada). Cria outra em Configuração → Autenticação → Chaves de API.',
      );
    }
    if (body.code === 'API_KEY_READ_ONLY') {
      throw new Error(
        'a chave de API do Gitea Mirror é só de leitura: para isto é preciso uma com acesso total',
      );
    }
    const detail =
      typeof body.error === 'string'
        ? body.error
        : typeof body.message === 'string'
          ? body.message
          : text.slice(0, 300);
    throw new Error(
      `o Gitea Mirror respondeu ${response.status} (${what}): ${detail}`,
    );
  }
  if (body.success === false) {
    throw new Error(
      `o Gitea Mirror não fez (${what}): ${typeof body.error === 'string' ? body.error : typeof body.message === 'string' ? body.message : ''}`,
    );
  }
  return body as T;
}

/** O estado (sem chave): saúde, versão e se há versão nova. */
export function giteaMirrorHealth(baseUrl: string) {
  return request<GiteaMirrorHealth>(
    `${normalizeGiteaMirrorUrl(baseUrl)}/api/health`,
    {},
    'o estado',
  );
}

/** A versão instalada, para as atualizações ("v3.54.0"). */
export async function giteaMirrorVersion(baseUrl: string) {
  const { version } = await giteaMirrorHealth(baseUrl);
  if (!version || version === 'unknown')
    throw new Error('O Gitea Mirror não disse a versão.');
  return `v${version.replace(/^v/, '')}`;
}

export function createGiteaMirrorClient(baseUrl: string, apiKey: string) {
  const root = normalizeGiteaMirrorUrl(baseUrl);
  const call = <T>(path: string, what: string, body?: unknown) =>
    request<T>(
      `${root}/api${path}`,
      {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      what,
    );

  return {
    repositories: () =>
      call<{ repositories?: GiteaMirrorRepository[] }>(
        '/github/repositories',
        'os repositórios',
      ).then((body) => body.repositories ?? []),
    organizations: () =>
      call<{ organizations?: GiteaMirrorOrganization[] }>(
        '/github/organizations',
        'as organizações',
      ).then((body) => body.organizations ?? []),
    activities: () =>
      call<{ activities?: GiteaMirrorActivity[] }>(
        '/activities',
        'a atividade',
      ).then((body) => body.activities ?? []),
    rateLimit: () =>
      call<{
        rateLimit?: { limit?: number; remaining?: number; reset?: string };
      }>('/rate-limit', 'o limite do GitHub').then((body) => body.rateLimit),
    /** Vai buscar às fontes (GitHub) os repositórios e organizações novos. */
    importAll: () =>
      call<{
        newRepositories?: number;
        newOrganizations?: number;
        failedSources?: unknown[];
      }>('/sync', 'importar das fontes', {}),
    addRepository: (owner: string, repo: string) =>
      call<{ repository?: GiteaMirrorRepository }>(
        '/sync/repository',
        `acrescentar ${owner}/${repo}`,
        { owner, repo },
      ),
    addOrganization: (org: string) =>
      call<{ organization?: GiteaMirrorOrganization }>(
        '/sync/organization',
        `acrescentar a organização ${org}`,
        { org },
      ),
    job: (job: GiteaMirrorJob, repositoryIds: string[]) =>
      call<{ message?: string }>(`/job/${job}`, job, { repositoryIds }),
    mcpTools: async (): Promise<
      { name: string; annotations?: { readOnlyHint?: boolean } }[] | null
    > => {
      try {
        const body = await call<{
          result?: {
            tools?: {
              name: string;
              annotations?: { readOnlyHint?: boolean };
            }[];
          };
        }>('/mcp', 'o MCP', { jsonrpc: '2.0', id: 1, method: 'tools/list' });
        return body.result?.tools ?? null;
      } catch {
        return null;
      }
    },
    mcpUrl: () => `${root}/api/mcp`,
  };
}

export type GiteaMirrorClient = ReturnType<typeof createGiteaMirrorClient>;
