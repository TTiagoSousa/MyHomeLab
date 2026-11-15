/** Uma instância Forgejo (ou Gitea, que tem a mesma API) e o token de quem a liga. */
export interface ForgejoConnection {
  baseUrl: string;
  token: string;
}

export interface ForgejoUser {
  login: string;
  email: string;
  full_name: string;
  is_admin: boolean;
}

export interface ForgejoRepo {
  full_name: string;
  empty: boolean;
  size: number;
  description: string;
  private: boolean;
  archived: boolean;
  open_issues_count: number;
  open_pr_counter: number;
  stars_count: number;
  default_branch: string;
  updated_at: string;
  html_url: string;
}

export interface ForgejoIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  user: { login: string };
  labels: { name: string }[];
  assignees: { login: string }[] | null;
  comments: number;
  created_at: string;
  updated_at: string;
  html_url: string;
  pull_request: unknown;
}

export interface ForgejoComment {
  user: { login: string };
  body: string;
  created_at: string;
}

export interface ForgejoRelease {
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string;
  assets: { name: string; size: number }[];
}

export interface ForgejoCommit {
  sha: string;
  commit: { message: string; author: { name: string; date: string } };
}

export interface ForgejoActionTask {
  name: string;
  display_title: string;
  status: string;
  event: string;
  head_branch: string;
  run_number: number;
  created_at: string;
  run_started_at: string;
  updated_at: string;
}

/** "https://git.exemplo.com/" ou ".../api/v1" ficam "https://git.exemplo.com". */
export function normalizeForgejoUrl(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/v1$/, '');
}

export class ForgejoError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ForgejoError';
  }
}

/**
 * O cliente da API do Forgejo (/api/v1). Só o que as ferramentas do assistente
 * usam; os erros trazem a mensagem do Forgejo para o agente a poder explicar.
 */
export function createForgejoClient({ baseUrl, token }: ForgejoConnection) {
  const root = `${normalizeForgejoUrl(baseUrl)}/api/v1`;

  const authHeaders = { Authorization: `token ${token}` };

  async function request<T>(
    path: string,
    init: {
      method?: string;
      body?: unknown;
      query?: Record<string, string | number | undefined>;
    } = {},
  ): Promise<T> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value !== undefined && value !== '') params.set(key, String(value));
    }
    const query = params.toString();
    const response = await fetch(`${root}${path}${query ? `?${query}` : ''}`, {
      method: init.method ?? 'GET',
      headers: {
        ...authHeaders,
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      let detail = '';
      try {
        detail =
          ((await response.json()) as { message?: string }).message ?? '';
      } catch {
        detail = '';
      }
      // O Forgejo repete o token na mensagem de um 401 ("access token does not
      // exist [sha: …]"): nunca pode chegar ao browser nem ao registo dos agentes.
      if (response.status === 401) {
        throw new ForgejoError(401, 'O token não é válido ou expirou');
      }
      throw new ForgejoError(
        response.status,
        `O Forgejo respondeu ${response.status}${detail ? `: ${detail.split(token).join('***')}` : ''}`,
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  const repoPath = (repo: string) =>
    `/repos/${repo
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/')}`;

  /** Todas as páginas de uma lista (a API devolve no máximo 50 de cada vez). */
  async function all<T>(
    path: string,
    query: Record<string, string | number | undefined> = {},
    unwrap: (page: unknown) => T[] = (page) => page as T[],
  ): Promise<T[]> {
    const items: T[] = [];
    for (let page = 1; ; page++) {
      const batch = unwrap(
        await request<unknown>(path, { query: { ...query, limit: 50, page } }),
      );
      items.push(...batch);
      if (batch.length < 50) return items;
    }
  }

  return {
    me: () => request<ForgejoUser>('/user'),

    version: () =>
      request<{ version: string }>('/version').then((data) => data.version),

    /** Admin: os repositórios da instância toda. Senão, os do dono do token. */
    allRepos: (admin: boolean) =>
      admin
        ? all<ForgejoRepo>(
            '/repos/search',
            { private: 'true' },
            (page) => (page as { data?: ForgejoRepo[] }).data ?? [],
          )
        : all<ForgejoRepo>('/user/repos'),

    allIssues: (repo: string) =>
      all<ForgejoIssue>(`${repoPath(repo)}/issues`, {
        state: 'all',
        type: 'issues',
      }).then(async (issues) => [
        ...issues,
        ...(await all<ForgejoIssue>(`${repoPath(repo)}/issues`, {
          state: 'all',
          type: 'pulls',
        })),
      ]),

    allComments: (repo: string) =>
      all<unknown>(`${repoPath(repo)}/issues/comments`),

    allLabels: (repo: string) => all<unknown>(`${repoPath(repo)}/labels`),

    allMilestones: (repo: string) =>
      all<unknown>(`${repoPath(repo)}/milestones`, { state: 'all' }),

    allReleases: (repo: string) => all<unknown>(`${repoPath(repo)}/releases`),

    /** O repositório inteiro do ramo, como git bundle (dá para "git clone" a partir dele). */
    bundle: async (repo: string, branch: string) => {
      const response = await fetch(
        `${root}${repoPath(repo)}/archive/${encodeURIComponent(branch)}.bundle`,
        { headers: authHeaders, signal: AbortSignal.timeout(10 * 60_000) },
      );
      if (!response.ok || !response.body) {
        throw new ForgejoError(
          response.status,
          `O Forgejo não deu o bundle de ${repo} (${response.status})`,
        );
      }
      return response.body;
    },

    /**
     * Admin: apaga os arquivos dos repositórios que o Forgejo guarda em cache (a pasta
     * repo-archive). Cada bundle pedido fica lá até à limpeza da meia-noite.
     */
    deleteRepoArchives: () =>
      request<void>('/admin/cron/delete_repo_archives', { method: 'POST' }),

    /** Admin: as tarefas do cron e quantas vezes cada uma já correu (exec_times). */
    cronTasks: () =>
      request<{ name: string; exec_times: number }[]>('/admin/cron', {
        query: { limit: 50 },
      }),

    repos: () =>
      request<ForgejoRepo[]>('/user/repos', { query: { limit: 50 } }),

    issues: (
      repo: string,
      options: {
        state: 'open' | 'closed' | 'all';
        type: 'issues' | 'pulls';
        limit: number;
      },
    ) =>
      request<ForgejoIssue[]>(`${repoPath(repo)}/issues`, {
        query: {
          state: options.state,
          type: options.type,
          limit: options.limit,
        },
      }),

    issue: (repo: string, number: number) =>
      request<ForgejoIssue>(`${repoPath(repo)}/issues/${number}`),

    comments: (repo: string, number: number) =>
      request<ForgejoComment[]>(`${repoPath(repo)}/issues/${number}/comments`),

    createIssue: (repo: string, issue: { title: string; body?: string }) =>
      request<ForgejoIssue>(`${repoPath(repo)}/issues`, {
        method: 'POST',
        body: issue,
      }),

    comment: (repo: string, number: number, body: string) =>
      request<ForgejoComment>(`${repoPath(repo)}/issues/${number}/comments`, {
        method: 'POST',
        body: { body },
      }),

    setIssueState: (repo: string, number: number, state: 'open' | 'closed') =>
      request<ForgejoIssue>(`${repoPath(repo)}/issues/${number}`, {
        method: 'PATCH',
        body: { state },
      }),

    releases: (repo: string, limit: number) =>
      request<ForgejoRelease[]>(`${repoPath(repo)}/releases`, {
        query: { limit },
      }),

    commits: (repo: string, branch: string | undefined, limit: number) =>
      request<ForgejoCommit[]>(`${repoPath(repo)}/commits`, {
        query: { sha: branch, limit, stat: 'false', files: 'false' },
      }),

    actionTasks: (repo: string, limit: number) =>
      request<{ workflow_runs: ForgejoActionTask[] | null }>(
        `${repoPath(repo)}/actions/tasks`,
        { query: { limit } },
      ),
  };
}

export type ForgejoClient = ReturnType<typeof createForgejoClient>;
