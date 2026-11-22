export interface AppRelease {
  version: string;
  url: string;
}

/** Guarda-se a resposta uma hora: várias contas da mesma app fazem um só pedido. */
const CACHE_MS = 60 * 60_000;
// As falhas também se guardam (15 min): sem Internet ou com o limite do GitHub esgotado,
// cada página de app esperava 15 s e voltava a perguntar, o que mantinha o limite esgotado.
const FAILURE_CACHE_MS = 15 * 60_000;
const cache = new Map<
  string,
  { at: number; release: AppRelease | null; error?: Error }
>();

/** A release mais recente de `key`, da cache (incluindo uma falha recente) ou do `load`. */
export async function rememberRelease(
  key: string,
  load: () => Promise<AppRelease | null>,
): Promise<AppRelease | null> {
  const hit = cache.get(key);
  if (hit) {
    const age = Date.now() - hit.at;
    if (hit.error && age < FAILURE_CACHE_MS) throw hit.error;
    if (!hit.error && age < CACHE_MS) return hit.release;
  }
  try {
    const release = await load();
    cache.set(key, { at: Date.now(), release });
    return release;
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    cache.set(key, { at: Date.now(), release: null, error: failure });
    throw failure;
  }
}

/** Os cabeçalhos para a API do GitHub; com GITHUB_TOKEN no .env o limite passa de 60 a 5000 pedidos/h. */
export function githubHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN?.trim();
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'MyHomeLab',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** "v4.3.3" → "4.3.3"; "13.0.1+gitea-1.22.0" → "13.0.1". */
export const cleanVersion = (version: string) =>
  version.trim().replace(/^v/i, '').split('+')[0];

/** Compara "4.10.0" com "4.9.2" número a número; > 0 quando `a` é mais recente. */
export function compareVersions(a: string, b: string): number {
  const partsA = cleanVersion(a)
    .split(/[.-]/)
    .map((part) => parseInt(part, 10) || 0);
  const partsB = cleanVersion(b)
    .split(/[.-]/)
    .map((part) => parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}

/**
 * A release estável mais recente de um repositório do Codeberg (onde vive o
 * Forgejo). Escolhe a versão mais alta e não a última publicada: uma correção
 * a uma versão LTS antiga pode sair depois da versão nova.
 */
export function latestCodebergRelease(
  repo: string,
): Promise<AppRelease | null> {
  return rememberRelease(repo, () => fetchCodebergRelease(repo));
}

async function fetchCodebergRelease(repo: string): Promise<AppRelease | null> {
  const response = await fetch(
    `https://codeberg.org/api/v1/repos/${repo}/releases?limit=20&draft=false&pre-release=false`,
    {
      headers: { Accept: 'application/json', 'User-Agent': 'MyHomeLab' },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) {
    throw new Error(`O Codeberg respondeu ${response.status}`);
  }
  const releases = (await response.json()) as {
    tag_name: string;
    html_url: string;
    prerelease: boolean;
    draft: boolean;
  }[];
  const stable = releases
    .filter((release) => !release.prerelease && !release.draft)
    .sort((a, b) => compareVersions(b.tag_name, a.tag_name))[0];
  return stable
    ? { version: cleanVersion(stable.tag_name), url: stable.html_url }
    : null;
}

/**
 * A release estável mais recente de um repositório do GitHub (ignora pré-versões
 * e rascunhos). Sem token, o GitHub aceita 60 pedidos por hora — daí a cache.
 */
export function latestGithubRelease(repo: string): Promise<AppRelease | null> {
  return rememberRelease(`github:${repo}`, () => fetchGithubRelease(repo));
}

async function fetchGithubRelease(repo: string): Promise<AppRelease | null> {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/releases?per_page=10`,
    { headers: githubHeaders(), signal: AbortSignal.timeout(15_000) },
  );
  if (!response.ok) {
    throw new Error(`O GitHub respondeu ${response.status}`);
  }
  const releases = (await response.json()) as {
    tag_name: string;
    html_url: string;
    prerelease: boolean;
    draft: boolean;
  }[];
  const published = releases.filter(
    (release) => !release.prerelease && !release.draft,
  );
  // A versão mais alta e não a última publicada (como no Codeberg): o Nextcloud, por
  // exemplo, publica três ramos no mesmo dia. Só entre as versões só com números — com
  // sufixos ("4.0.0-beta.420") fica a última publicada, como antes.
  const numeric = published
    .filter((release) => /^\d+(\.\d+)*$/.test(cleanVersion(release.tag_name)))
    .sort((a, b) => compareVersions(b.tag_name, a.tag_name));
  const stable = numeric[0] ?? published[0];
  return stable
    ? { version: cleanVersion(stable.tag_name), url: stable.html_url }
    : null;
}

/** Onde vivem as releases de uma app. */
export interface ReleaseRepository {
  host: 'github' | 'codeberg';
  repo: string;
}

export interface ReleaseNote {
  version: string;
  url: string;
  publishedAt: string | null;
  body: string;
}

export interface KnownIssue {
  title: string;
  url: string;
  state: string;
  comments: number;
  createdAt: string;
  labels: string[];
}

const jsonHeaders = (host: ReleaseRepository['host']) =>
  host === 'github'
    ? githubHeaders()
    : { Accept: 'application/json', 'User-Agent': 'MyHomeLab' };

async function getJson<T>(
  host: ReleaseRepository['host'],
  url: string,
): Promise<T> {
  const response = await fetch(url, {
    headers: jsonHeaders(host),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(
      `O ${host === 'github' ? 'GitHub' : 'Codeberg'} respondeu ${response.status}`,
    );
  }
  return (await response.json()) as T;
}

/**
 * As notas de todas as releases estáveis depois de `from` até `to` (inclusive),
 * da mais antiga para a mais recente — o que muda ao saltar várias versões.
 */
export async function releaseHistory(
  source: ReleaseRepository,
  from: string,
  to: string,
  maxBody = 6000,
): Promise<ReleaseNote[]> {
  const url =
    source.host === 'github'
      ? `https://api.github.com/repos/${source.repo}/releases?per_page=100`
      : `https://codeberg.org/api/v1/repos/${source.repo}/releases?limit=50&draft=false&pre-release=false`;
  const releases = await getJson<
    {
      tag_name: string;
      html_url: string;
      prerelease: boolean;
      draft: boolean;
      published_at?: string | null;
      body?: string | null;
    }[]
  >(source.host, url);
  return releases
    .filter(
      (release) =>
        !release.prerelease &&
        !release.draft &&
        compareVersions(release.tag_name, from) > 0 &&
        compareVersions(release.tag_name, to) <= 0,
    )
    .sort((a, b) => compareVersions(a.tag_name, b.tag_name))
    .map((release) => {
      const body = (release.body ?? '').trim();
      return {
        version: cleanVersion(release.tag_name),
        url: release.html_url,
        publishedAt: release.published_at ?? null,
        body:
          body.length > maxBody
            ? `${body.slice(0, maxBody)}\n… (cortado; o resto está em ${release.html_url})`
            : body,
      };
    });
}

/**
 * As issues abertas desde uma data (a da release nova), as mais comentadas
 * primeiro — é onde aparecem os problemas de uma versão acabada de sair.
 */
/**
 * O nome atual de um repositório do GitHub: a pesquisa não segue as mudanças de
 * nome (ex.: home-assistant/addons → home-assistant/apps), a API dos repositórios sim.
 */
async function currentGithubRepo(repo: string): Promise<string> {
  const found = await getJson<{ full_name?: string }>(
    'github',
    `https://api.github.com/repos/${repo}`,
  ).catch(() => null);
  return found?.full_name ?? repo;
}

/**
 * As issues abertas desde uma data, as mais comentadas primeiro. `terms` limita
 * a pesquisa (ex.: o add-on dentro de um repositório com vários).
 */
export async function issuesSince(
  source: ReleaseRepository,
  since: Date,
  limit = 15,
  terms?: string,
): Promise<KnownIssue[]> {
  if (source.host === 'github') {
    type SearchResult = {
      items: {
        title: string;
        html_url: string;
        state: string;
        comments: number;
        created_at: string;
        labels: { name: string }[];
      }[];
    };
    const search = (repo: string) =>
      getJson<SearchResult>(
        'github',
        `https://api.github.com/search/issues?q=${encodeURIComponent(
          `repo:${repo} is:issue created:>=${since.toISOString().slice(0, 10)}${terms ? ` ${terms}` : ''}`,
        )}&sort=comments&order=desc&per_page=${limit}`,
      );
    const result = await search(source.repo).catch(async (error: unknown) => {
      if (!(error instanceof Error) || !error.message.includes('422')) {
        throw error;
      }
      const renamed = await currentGithubRepo(source.repo);
      if (renamed === source.repo) throw error;
      return search(renamed);
    });
    return result.items.map((item) => ({
      title: item.title,
      url: item.html_url,
      state: item.state,
      comments: item.comments,
      createdAt: item.created_at,
      labels: item.labels.map((label) => label.name),
    }));
  }
  const items = await getJson<
    {
      title: string;
      html_url: string;
      state: string;
      comments: number;
      created_at: string;
      labels: { name: string }[];
    }[]
  >(
    'codeberg',
    `https://codeberg.org/api/v1/repos/${source.repo}/issues?type=issues&state=all&since=${since.toISOString()}&limit=50`,
  );
  return items
    .sort((a, b) => b.comments - a.comments)
    .slice(0, limit)
    .map((item) => ({
      title: item.title,
      url: item.html_url,
      state: item.state,
      comments: item.comments,
      createdAt: item.created_at,
      labels: item.labels.map((label) => label.name),
    }));
}
