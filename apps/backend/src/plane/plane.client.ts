import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { describeFetchError, parseAppJson } from 'src/integrations/app-fetch';

// O Plane (gestão de projetos): a API pública em <endereço>/api/v1/workspaces/<slug>/…, com o
// token pessoal (Definições do perfil → Personal Access Tokens) no cabeçalho "X-API-Key".
// Todos os caminhos acabam em "/". A versão instalada vem de /api/instances/ (sem token).
// Limite: 60 pedidos por minuto por token (API_KEY_RATE_LIMIT no servidor). O Plane Community
// não tem MCP no servidor (o oficial é um programa Python à parte): ficam as plane_*.

export const PLANE_REPOSITORY = 'makeplane/plane';

/** Tira o que se cola a mais: espaços, a barra do fim, um /api colado ou o slug no fim. */
export const normalizePlaneUrl = (url: string) =>
  url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(api|god-mode)(\/.*)?$/i, '');

/** O slug do espaço de trabalho: o próprio, ou tirado de um link do Plane. */
export function planeSlug(value: string): string {
  const text = value.trim().replace(/\/+$/, '');
  try {
    const [first] = new URL(text).pathname.split('/').filter(Boolean);
    return (first ?? '').toLowerCase();
  } catch {
    return text.replace(/^\/+/, '').split('/')[0].toLowerCase();
  }
}

export interface PlaneUser {
  id: string;
  display_name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface PlaneProject {
  id: string;
  name: string;
  identifier: string;
  description?: string;
  archived_at?: string | null;
  total_members?: number;
}

export interface PlaneState {
  id: string;
  name: string;
  group: string;
  color?: string;
}

export interface PlaneLabel {
  id: string;
  name: string;
  color?: string;
}

export interface PlaneMember {
  id: string;
  display_name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface PlaneWorkItem {
  id: string;
  name: string;
  sequence_id: number;
  project: string;
  state: string;
  priority: string;
  assignees: string[];
  labels: string[];
  parent?: string | null;
  start_date?: string | null;
  target_date?: string | null;
  description_html?: string;
  description_stripped?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface PlaneComment {
  id: string;
  comment_html?: string;
  comment_stripped?: string;
  actor?: string;
  created_by?: string;
  created_at: string;
}

export interface PlaneCycle {
  id: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  status?: string;
}

export interface PlaneModule {
  id: string;
  name: string;
  status?: string;
}

interface Page<T> {
  results: T[];
  next_cursor?: string;
  next_page_results?: boolean;
  total_results?: number;
}

export type PlaneWorkItemInput = Partial<{
  name: string;
  description_html: string;
  state: string;
  priority: string;
  assignees: string[];
  labels: string[];
  parent: string | null;
  start_date: string | null;
  target_date: string | null;
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
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new AppIntegrationError(
      'APP_UNREACHABLE',
      `Não foi possível falar com o Plane (${what}): ${describeFetchError(error)}`,
    );
  }
  const text = await response.text();
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AppIntegrationError(
        'APP_AUTH_FAILED',
        'O Plane recusou o token (foi apagado, expirou ou não tem acesso a este espaço). Cria outro em Definições do perfil → Personal Access Tokens.',
      );
    }
    if (response.status === 429) {
      throw new Error(
        'o Plane está a limitar os pedidos (60 por minuto): espera um minuto e tenta outra vez',
      );
    }
    let detail = text.slice(0, 300);
    try {
      const body = JSON.parse(text) as Record<string, unknown>;
      detail =
        typeof body.error === 'string'
          ? body.error
          : typeof body.detail === 'string'
            ? body.detail
            : JSON.stringify(body).slice(0, 300);
    } catch {
      /* fica o texto */
    }
    throw new Error(
      response.status === 404
        ? `o Plane não encontrou isso (${what})`
        : `o Plane respondeu ${response.status} (${what}): ${detail}`,
    );
  }
  return parseAppJson<T>(text, 'Plane', what);
}

/** A instância (sem token): a versão e o nome. */
export async function planeInstance(baseUrl: string) {
  const body = await request<{
    instance?: {
      current_version?: string;
      latest_version?: string;
      edition?: string;
      instance_name?: string;
    };
    is_activated?: boolean;
  }>(`${normalizePlaneUrl(baseUrl)}/api/instances/`, {}, 'a instância');
  if (!body.instance) {
    throw new Error(
      'este endereço não é um Plane (ou ainda não foi configurado)',
    );
  }
  return body.instance;
}

/** A versão instalada, para as atualizações ("v1.5.0"). */
export async function planeVersion(baseUrl: string) {
  const { current_version } = await planeInstance(baseUrl);
  if (!current_version) throw new Error('O Plane não disse a versão.');
  return `v${current_version.replace(/^v/, '')}`;
}

export function createPlaneClient(
  baseUrl: string,
  apiKey: string,
  slug: string,
) {
  const root = `${normalizePlaneUrl(baseUrl)}/api/v1`;
  const space = `${root}/workspaces/${encodeURIComponent(slug)}`;
  const call = <T>(
    path: string,
    what: string,
    init: { method?: string; body?: unknown } = {},
  ) =>
    request<T>(
      `${path.startsWith('/users') ? root : space}${path}`,
      {
        method: init.method ?? 'GET',
        headers: {
          'X-API-Key': apiKey,
          ...(init.body !== undefined
            ? { 'Content-Type': 'application/json' }
            : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      },
      what,
    );
  const list = async <T>(path: string, what: string, max = 1000) => {
    const items: T[] = [];
    let cursor: string | undefined;
    do {
      const join = path.includes('?') ? '&' : '?';
      const page = await call<Page<T> | T[]>(
        `${path}${join}per_page=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        what,
      );
      if (Array.isArray(page)) return page;
      items.push(...(page.results ?? []));
      cursor = page.next_page_results ? page.next_cursor : undefined;
    } while (cursor && items.length < max);
    return items;
  };
  const project = (id: string) => `/projects/${encodeURIComponent(id)}`;

  return {
    me: () => call<PlaneUser>('/users/me/', 'o utilizador do token'),
    projects: () => list<PlaneProject>('/projects/', 'os projetos'),
    states: (projectId: string) =>
      list<PlaneState>(`${project(projectId)}/states/`, 'os estados'),
    labels: (projectId: string) =>
      list<PlaneLabel>(`${project(projectId)}/labels/`, 'as etiquetas'),
    members: () =>
      call<PlaneMember[] | Page<PlaneMember>>('/members/', 'os membros').then(
        (body) => (Array.isArray(body) ? body : body.results),
      ),
    cycles: (projectId: string) =>
      list<PlaneCycle>(`${project(projectId)}/cycles/`, 'os ciclos'),
    modules: (projectId: string) =>
      list<PlaneModule>(`${project(projectId)}/modules/`, 'os módulos'),
    workItems: (projectId: string, max = 500) =>
      list<PlaneWorkItem>(
        `${project(projectId)}/work-items/?order_by=-updated_at`,
        'as tarefas',
        max,
      ),
    /** Pela chave ("WEB-12"). */
    workItemByKey: (key: string) =>
      call<PlaneWorkItem>(
        `/work-items/${encodeURIComponent(key.toUpperCase())}/`,
        `a tarefa ${key}`,
      ),
    search: (text: string) =>
      call<{
        issues: {
          id: string;
          name: string;
          sequence_id: number;
          project__identifier: string;
          project_id: string;
        }[];
      }>(
        `/work-items/search/?search=${encodeURIComponent(text)}&limit=25&workspace_search=true`,
        'a pesquisa',
      ).then((body) => body.issues ?? []),
    createWorkItem: (projectId: string, input: PlaneWorkItemInput) =>
      call<PlaneWorkItem>(
        `${project(projectId)}/work-items/`,
        'criar a tarefa',
        {
          method: 'POST',
          body: input,
        },
      ),
    updateWorkItem: (
      projectId: string,
      id: string,
      input: PlaneWorkItemInput,
    ) =>
      call<PlaneWorkItem>(
        `${project(projectId)}/work-items/${encodeURIComponent(id)}/`,
        'mudar a tarefa',
        { method: 'PATCH', body: input },
      ),
    comments: (projectId: string, id: string) =>
      list<PlaneComment>(
        `${project(projectId)}/work-items/${encodeURIComponent(id)}/comments/`,
        'os comentários',
      ),
    addComment: (projectId: string, id: string, html: string) =>
      call<PlaneComment>(
        `${project(projectId)}/work-items/${encodeURIComponent(id)}/comments/`,
        'comentar',
        { method: 'POST', body: { comment_html: html } },
      ),
  };
}

export type PlaneClient = ReturnType<typeof createPlaneClient>;
