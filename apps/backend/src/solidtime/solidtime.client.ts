import axios from 'axios';
import { Agent } from 'https';
import { AppIntegrationError } from 'src/integrations/app-integration.error';

// O solidtime (o registo de horas self-hosted): a API REST em <endereço>/api/v1, com um
// token pessoal (Perfil → Tokens da API) no "Authorization: Bearer". O token age como o
// utilizador, em cada organização com o papel que ele lá tem (owner, admin, manager,
// employee). Cada conta ligada no MyHomeLab é uma organização (a do membro guardado em
// username). A API não diz a versão instalada.

/** O repositório das releases (as notas e as issues das atualizações). */
export const SOLIDTIME_REPOSITORY = 'solidtime-io/solidtime';

export const SOLIDTIME_GROUPS = [
  'day',
  'week',
  'month',
  'year',
  'user',
  'project',
  'task',
  'client',
  'billable',
  'description',
  'tag',
] as const;
export type SolidtimeGroup = (typeof SOLIDTIME_GROUPS)[number];

export const SOLIDTIME_OBJECTS = [
  'projects',
  'clients',
  'tasks',
  'tags',
] as const;
export type SolidtimeObjectKind = (typeof SOLIDTIME_OBJECTS)[number];

export interface SolidtimeUser {
  id: string;
  name: string;
  email: string;
  timezone: string;
  week_start: string;
}

export interface SolidtimeMembership {
  id: string;
  organization: { id: string; name: string; currency: string };
  role: string;
}

export interface SolidtimeEntry {
  id: string;
  start: string;
  end: string | null;
  duration: number | null;
  description: string | null;
  task_id: string | null;
  project_id: string | null;
  user_id: string;
  tags: string[];
  billable: boolean;
}

export interface SolidtimeEntryInput {
  member_id?: string;
  start?: string;
  end?: string | null;
  description?: string | null;
  project_id?: string | null;
  task_id?: string | null;
  tags?: string[];
  billable?: boolean;
}

export interface SolidtimeObject {
  id: string;
  name: string;
  color?: string;
  client_id?: string | null;
  project_id?: string;
  is_archived?: boolean;
  is_billable?: boolean;
  is_done?: boolean;
  estimated_time?: number | null;
  spent_time?: number;
}

export interface SolidtimeAggregate {
  seconds: number;
  cost: number | null;
  grouped_type: string | null;
  grouped_data:
    | {
        key: string | null;
        seconds: number;
        cost: number | null;
        grouped_type: string | null;
        grouped_data: SolidtimeAggregate['grouped_data'];
      }[]
    | null;
}

const httpsAgent = new Agent({ rejectUnauthorized: false });

export const normalizeSolidtimeUrl = (url: string) =>
  url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api(\/v1)?$/, '');

/** A hora como o solidtime a quer: UTC, sem milissegundos ("2026-11-17T09:00:00Z"). */
export const solidtimeTime = (date: Date) =>
  `${date.toISOString().slice(0, 19)}Z`;

function failure(error: unknown, what: string): AppIntegrationError {
  if (error instanceof AppIntegrationError) return error;
  if (axios.isAxiosError(error) && error.response) {
    const status = error.response.status;
    const body = error.response.data as
      { message?: unknown; errors?: Record<string, string[]> } | undefined;
    const details = body?.errors
      ? Object.values(body.errors).flat().join('; ')
      : '';
    const message =
      details || (typeof body?.message === 'string' ? body.message : '');
    if (status === 401) {
      return new AppIntegrationError(
        'APP_AUTH_FAILED',
        'O solidtime recusou o token (expirou ou foi revogado). Cria outro em Perfil → Tokens da API.',
      );
    }
    if (status === 403) {
      return new AppIntegrationError(
        'APP_AUTH_FAILED',
        `O solidtime não deixou (${what})${message ? `: ${message}` : ''}. O papel do utilizador nesta organização não chega.`,
      );
    }
    return new AppIntegrationError(
      status === 404 ? 'APP_NOT_SUPPORTED' : 'APP_UNREACHABLE',
      `O solidtime respondeu ${status} em ${what}${message ? `: ${message}` : ''}`,
    );
  }
  return new AppIntegrationError(
    'APP_UNREACHABLE',
    `Não foi possível falar com o solidtime: ${error instanceof Error ? error.message : String(error)}`,
  );
}

/** Se está de pé (/health-check/up, sem token). */
export async function solidtimeUp(baseUrl: string) {
  try {
    const { data } = await axios.get<{ success?: boolean }>(
      `${normalizeSolidtimeUrl(baseUrl)}/health-check/up`,
      { httpsAgent, timeout: 15_000 },
    );
    if (data?.success !== true) {
      throw new AppIntegrationError(
        'APP_UNREACHABLE',
        'Este endereço não é um solidtime (o /health-check/up não o diz).',
      );
    }
  } catch (error) {
    throw failure(error, '/health-check/up');
  }
}

export function createSolidtimeClient(baseUrl: string, token: string) {
  const root = normalizeSolidtimeUrl(baseUrl);
  const http = axios.create({
    baseURL: `${root}/api/v1`,
    httpsAgent,
    timeout: 30_000,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const call = async <T>(what: string, run: () => Promise<{ data: T }>) => {
    try {
      return (await run()).data;
    } catch (error) {
      throw failure(error, what);
    }
  };
  const data = async <T>(
    what: string,
    run: () => Promise<{ data: { data: T } }>,
  ) => (await call(what, run)).data;
  /** Todas as páginas de uma lista (o solidtime pagina com links.next). */
  const listAll = async <T>(
    path: string,
    params: Record<string, unknown> = {},
  ) => {
    const items: T[] = [];
    for (let page = 1; page <= 50; page += 1) {
      const body = await call(path, () =>
        http.get<{ data: T[]; links?: { next?: string | null } }>(path, {
          params: { ...params, page },
        }),
      );
      items.push(...body.data);
      if (!body.links?.next) break;
    }
    return items;
  };

  return {
    me: () => data<SolidtimeUser>('/users/me', () => http.get('/users/me')),
    memberships: () =>
      data<SolidtimeMembership[]>('/users/me/memberships', () =>
        http.get('/users/me/memberships'),
      ),
    activeEntry: async () => {
      try {
        return (
          await http.get<{ data: SolidtimeEntry }>(
            '/users/me/time-entries/active',
          )
        ).data.data;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return null;
        }
        throw failure(error, '/users/me/time-entries/active');
      }
    },

    entries: (
      organization: string,
      params: {
        member_id?: string;
        start?: string;
        end?: string;
        project_ids?: string[];
        limit?: number;
      },
    ) =>
      call('/time-entries', () =>
        http.get<{ data: SolidtimeEntry[]; meta?: { total?: number } }>(
          `/organizations/${organization}/time-entries`,
          { params },
        ),
      ),
    aggregate: (
      organization: string,
      params: {
        group: SolidtimeGroup;
        sub_group?: SolidtimeGroup;
        start?: string;
        end?: string;
        member_id?: string;
      },
    ) =>
      data<SolidtimeAggregate>('/time-entries/aggregate', () =>
        http.get(`/organizations/${organization}/time-entries/aggregate`, {
          params,
        }),
      ),
    createEntry: (organization: string, input: SolidtimeEntryInput) =>
      data<SolidtimeEntry>('POST /time-entries', () =>
        http.post(`/organizations/${organization}/time-entries`, input),
      ),
    updateEntry: (
      organization: string,
      id: string,
      input: SolidtimeEntryInput,
    ) =>
      data<SolidtimeEntry>('PUT /time-entries/:id', () =>
        http.put(`/organizations/${organization}/time-entries/${id}`, input),
      ),

    objects: (organization: string, kind: SolidtimeObjectKind) =>
      listAll<SolidtimeObject>(`/organizations/${organization}/${kind}`),
    createObject: (
      organization: string,
      kind: SolidtimeObjectKind,
      input: Record<string, unknown>,
    ) =>
      data<SolidtimeObject>(`POST /${kind}`, () =>
        http.post(`/organizations/${organization}/${kind}`, input),
      ),
    updateObject: (
      organization: string,
      kind: SolidtimeObjectKind,
      id: string,
      input: Record<string, unknown>,
    ) =>
      data<SolidtimeObject>(`PUT /${kind}/:id`, () =>
        http.put(`/organizations/${organization}/${kind}/${id}`, input),
      ),

    /** O export da organização (um zip com tudo): pede-o e descarrega-o do link temporário. */
    exportOrganization: async (organization: string) => {
      const { download_url: url } = await call('POST /export', () =>
        http.post<{ success: boolean; download_url: string }>(
          `/organizations/${organization}/export`,
        ),
      );
      try {
        const response = await axios.get<ArrayBuffer>(url, {
          httpsAgent,
          responseType: 'arraybuffer',
          timeout: 600_000,
        });
        return Buffer.from(response.data);
      } catch (error) {
        throw failure(error, 'o download do export');
      }
    },
  };
}

export type SolidtimeClient = ReturnType<typeof createSolidtimeClient>;
