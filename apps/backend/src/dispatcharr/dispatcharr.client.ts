import { Readable } from 'stream';
import type { ReadableStream as WebReadableStream } from 'stream/web';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { describeFetchError } from 'src/integrations/app-fetch';

// O Dispatcharr (gere listas IPTV, canais, EPG e o proxy dos streams): a API REST (Django) em
// <endereço>/api/…, com a chave de API pessoal (desde a v0.20: o utilizador → API & XC →
// Gerar) no cabeçalho "X-API-Key". Quase tudo pede um utilizador administrador. Os caminhos
// acabam em "/" (os do proxy, em /proxy/…, não). /api/core/version/ não pede chave e diz a
// versão. Tem backups próprios (/api/backups/, um zip da base de dados) que se descarregam.
// Não há MCP: ficam as dispatcharr_*.

export const DISPATCHARR_REPOSITORY = 'Dispatcharr/Dispatcharr';

/** Tira o que se cola a mais: espaços, a barra do fim, um /api ou uma página da interface. */
export const normalizeDispatcharrUrl = (url: string) =>
  url
    .trim()
    .replace(/[#?].*$/, '')
    .replace(/\/+$/, '')
    .replace(/\/(api|swagger|channels|settings|stats|guide|dvr)(\/.*)?$/i, '');

export interface DispatcharrChannel {
  id: number;
  uuid: string;
  name: string;
  channel_number: number | null;
  channel_group_id: number | null;
  tvg_id?: string | null;
  epg_data_id?: number | null;
  streams?: number[];
  stream_profile_id?: number | null;
  hidden_from_output?: boolean;
  is_adult?: boolean;
  auto_created?: boolean;
  auto_created_by_name?: string | null;
  effective_name?: string;
  effective_channel_number?: number | null;
  effective_channel_group_id?: number | null;
  effective_tvg_id?: string | null;
  effective_epg_data_id?: number | null;
}

export interface DispatcharrGroup {
  id: number;
  name: string;
  channel_count?: number;
}

export interface DispatcharrStream {
  id: number;
  name: string;
  url?: string;
  m3u_account?: number | null;
  channel_group?: number | null;
  tvg_id?: string | null;
  current_viewers?: number;
  is_stale?: boolean;
  is_custom?: boolean;
  last_seen?: string | null;
  stream_stats?: Record<string, unknown> | null;
}

export interface DispatcharrM3UAccount {
  id: number;
  name: string;
  server_url?: string | null;
  account_type?: string;
  max_streams?: number;
  is_active?: boolean;
  status?: string;
  last_message?: string | null;
  updated_at?: string;
  refresh_interval?: number;
  priority?: number;
  username?: string | null;
  password?: string | null;
}

export interface DispatcharrEpgSource {
  id: number;
  name: string;
  source_type?: string;
  url?: string | null;
  is_active?: boolean;
  status?: string;
  last_message?: string | null;
  updated_at?: string;
  refresh_interval?: number;
  username?: string | null;
  password?: string | null;
  api_key?: string | null;
}

export interface DispatcharrLiveClient {
  client_id: string;
  ip_address?: string;
  user_agent?: string;
  connected_at?: number;
  user_id?: number;
}

export interface DispatcharrLiveChannel {
  channel_id: string;
  channel_name?: string;
  state?: string;
  stream_name?: string;
  stream_id?: number;
  stream_profile?: string;
  client_count?: number;
  uptime?: number;
  avg_bitrate?: string;
  total_bytes?: number;
  healthy?: boolean;
  clients?: DispatcharrLiveClient[];
}

export interface DispatcharrStats {
  live?: { channels?: DispatcharrLiveChannel[]; count?: number };
  vod?: { connections?: unknown[]; count?: number; [key: string]: unknown };
  catchup?: { sessions?: unknown[]; count?: number; [key: string]: unknown };
}

export interface DispatcharrRecording {
  id: number;
  channel: number;
  start_time: string;
  end_time: string;
  custom_properties?: {
    status?: string;
    program?: { title?: string; sub_title?: string };
    [key: string]: unknown;
  } | null;
}

export interface DispatcharrBackup {
  name: string;
  size: number;
  created: string;
}

export type DispatcharrChannelInput = Partial<{
  name: string;
  channel_number: number;
  channel_group_id: number;
  tvg_id: string;
  epg_data_id: number | null;
  streams: number[];
  hidden_from_output: boolean;
}>;

interface Page<T> {
  count?: number;
  next?: string | null;
  results?: T[];
}

const unwrap = <T>(body: T[] | Page<T>) =>
  Array.isArray(body) ? body : (body.results ?? []);

const detailOf = (text: string) => {
  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    if (typeof body.detail === 'string') return body.detail;
    if (typeof body.error === 'string') return body.error;
    if (typeof body.message === 'string') return body.message;
    return JSON.stringify(body).slice(0, 300);
  } catch {
    return text.slice(0, 300);
  }
};

async function send(
  url: string,
  init: RequestInit,
  what: string,
  timeoutMs = 30_000,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    });
  } catch (error) {
    throw new AppIntegrationError(
      'APP_UNREACHABLE',
      `Não foi possível falar com o Dispatcharr (${what}): ${describeFetchError(error)}`,
    );
  }
  if (response.ok) return response;
  const text = await response.text();
  if (response.status === 401) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O Dispatcharr recusou a chave de API (revogada ou errada). Gera outra no Dispatcharr: o teu utilizador → API & XC → Gerar.',
    );
  }
  if (response.status === 403) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      `O Dispatcharr não deixa fazer isto com esta chave (${what}): a chave tem de ser de um utilizador administrador.`,
    );
  }
  if (response.status === 429) {
    throw new Error(
      'o Dispatcharr está a limitar os pedidos (tentativas falhadas a mais): espera um minuto',
    );
  }
  throw new Error(
    response.status === 404
      ? `o Dispatcharr não encontrou isso (${what})`
      : `o Dispatcharr respondeu ${response.status} (${what}): ${detailOf(text)}`,
  );
}

async function request<T>(
  url: string,
  init: RequestInit,
  what: string,
): Promise<T> {
  const response = await send(url, init, what);
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `a resposta do Dispatcharr não é JSON (${what}): este endereço é mesmo um Dispatcharr?`,
    );
  }
}

/** A versão (sem chave), de /api/core/version/. */
export async function dispatcharrVersionInfo(baseUrl: string) {
  const body = await request<{ version?: string; timestamp?: string | null }>(
    `${normalizeDispatcharrUrl(baseUrl)}/api/core/version/`,
    {},
    'a versão',
  );
  if (!body.version) {
    throw new Error('este endereço não é um Dispatcharr (não diz a versão)');
  }
  return body;
}

/** A versão instalada, para as atualizações ("v0.34.1"). */
export async function dispatcharrVersion(baseUrl: string) {
  const { version } = await dispatcharrVersionInfo(baseUrl);
  if (!version) throw new Error('O Dispatcharr não disse a versão.');
  return `v${version.replace(/^v/, '')}`;
}

export function createDispatcharrClient(baseUrl: string, apiKey: string) {
  const root = normalizeDispatcharrUrl(baseUrl);
  const headers = (json: boolean) => ({
    'X-API-Key': apiKey,
    Accept: 'application/json',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  });
  const call = <T>(
    path: string,
    what: string,
    init: { method?: string; body?: unknown } = {},
  ) =>
    request<T>(
      `${root}${path}`,
      {
        method: init.method ?? 'GET',
        headers: headers(init.body !== undefined),
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      },
      what,
    );
  const query = (
    params: Record<string, string | number | boolean | undefined>,
  ) =>
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
      )
      .join('&');
  const page = async <T>(path: string, what: string, size: number) => {
    const join = path.includes('?') ? '&' : '?';
    const body = await call<Page<T> | T[]>(
      `${path}${join}page=1&page_size=${size}`,
      what,
    );
    return {
      items: unwrap(body),
      total: Array.isArray(body) ? body.length : (body.count ?? 0),
    };
  };
  /** Pede um backup (corre em segundo plano) e devolve o id da tarefa. */
  const startBackup = () =>
    call<{ task_id?: string; task_token?: string; detail?: string }>(
      '/api/backups/create/',
      'começar o backup',
      { method: 'POST', body: {} },
    );
  const backupStatus = (taskId: string) =>
    call<{
      state?: string;
      result?: { status?: string; filename?: string };
      error?: string;
    }>(
      `/api/backups/status/${encodeURIComponent(taskId)}/`,
      'o estado do backup',
    );
  /** Pede o backup e espera que acabe; devolve o nome do zip. */
  const createBackup = async (timeoutMs = 15 * 60_000, pollMs = 3_000) => {
    const started = await startBackup();
    const taskId = started.task_id;
    if (!taskId) {
      throw new Error(
        `o Dispatcharr não começou o backup${started.detail ? `: ${started.detail}` : ''}`,
      );
    }
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      const status = await backupStatus(taskId);
      if (status.state === 'completed' && status.result?.filename) {
        return status.result.filename;
      }
      if (status.state === 'failed') {
        throw new Error(
          `o backup do Dispatcharr falhou: ${status.error ?? 'sem motivo'}`,
        );
      }
    }
    throw new Error(
      `o backup do Dispatcharr demorou demais (${Math.round(timeoutMs / 60_000)} minutos)`,
    );
  };

  return {
    me: () =>
      call<{ id: number; username: string; user_level?: number }>(
        '/api/accounts/users/me/',
        'o utilizador da chave',
      ),
    channels: (
      filters: { search?: string; group?: string; limit?: number } = {},
    ) =>
      page<DispatcharrChannel>(
        `/api/channels/channels/?${query({
          search: filters.search,
          channel_group: filters.group,
          ordering: 'channel_number',
        })}`,
        'os canais',
        filters.limit ?? 100,
      ),
    channel: (id: number) =>
      call<DispatcharrChannel>(`/api/channels/channels/${id}/`, 'o canal'),
    channelStreams: (id: number) =>
      call<DispatcharrStream[] | Page<DispatcharrStream>>(
        `/api/channels/channels/${id}/streams/`,
        'os streams do canal',
      ).then(unwrap),
    updateChannel: (id: number, input: Record<string, unknown>) =>
      call<DispatcharrChannel>(
        `/api/channels/channels/${id}/`,
        'mudar o canal',
        {
          method: 'PATCH',
          body: input,
        },
      ),
    createChannelFromStream: (input: {
      stream_id: number;
      name?: string;
      channel_number?: number;
    }) =>
      call<DispatcharrChannel>(
        '/api/channels/channels/from-stream/',
        'criar o canal',
        { method: 'POST', body: input },
      ),
    deleteChannel: (id: number) =>
      call<unknown>(`/api/channels/channels/${id}/`, 'apagar o canal', {
        method: 'DELETE',
      }),
    groups: () =>
      call<DispatcharrGroup[] | Page<DispatcharrGroup>>(
        '/api/channels/groups/',
        'os grupos',
      ).then(unwrap),
    streams: (
      filters: {
        search?: string;
        m3uAccount?: number;
        group?: string;
        limit?: number;
      } = {},
    ) =>
      page<DispatcharrStream>(
        `/api/channels/streams/?${query({
          search: filters.search,
          m3u_account: filters.m3uAccount,
          channel_group_name: filters.group,
          ordering: 'name',
        })}`,
        'os streams',
        filters.limit ?? 50,
      ),
    m3uAccounts: () =>
      call<DispatcharrM3UAccount[] | Page<DispatcharrM3UAccount>>(
        '/api/m3u/accounts/',
        'as contas M3U',
      ).then(unwrap),
    refreshM3u: (accountId?: number) =>
      call<{ message?: string; success?: boolean }>(
        accountId ? `/api/m3u/refresh/${accountId}/` : '/api/m3u/refresh/',
        'atualizar as M3U',
        { method: 'POST', body: {} },
      ),
    epgSources: () =>
      call<DispatcharrEpgSource[] | Page<DispatcharrEpgSource>>(
        '/api/epg/sources/',
        'as fontes de EPG',
      ).then(unwrap),
    refreshEpg: (sourceId?: number, force = false) =>
      call<{ message?: string; success?: boolean }>(
        '/api/epg/import/',
        'atualizar o EPG',
        {
          method: 'POST',
          body: sourceId ? { id: sourceId, force } : { force },
        },
      ),
    stats: () => call<DispatcharrStats>('/proxy/stats/', 'as ligações'),
    stopChannel: (channelUuid: string) =>
      call<{ message?: string }>(
        `/proxy/ts/stop/${encodeURIComponent(channelUuid)}`,
        'parar o canal',
        { method: 'POST', body: {} },
      ),
    stopClient: (channelUuid: string, clientId: string) =>
      call<{ message?: string }>(
        `/proxy/ts/stop_client/${encodeURIComponent(channelUuid)}`,
        'desligar o cliente',
        { method: 'POST', body: { client_id: clientId } },
      ),
    recordings: () =>
      call<DispatcharrRecording[] | Page<DispatcharrRecording>>(
        '/api/channels/recordings/',
        'as gravações',
      ).then(unwrap),
    createRecording: (input: {
      channel: number;
      start_time: string;
      end_time: string;
      title?: string;
    }) =>
      call<DispatcharrRecording>(
        '/api/channels/recordings/',
        'agendar a gravação',
        {
          method: 'POST',
          body: {
            channel: input.channel,
            start_time: input.start_time,
            end_time: input.end_time,
            custom_properties: input.title
              ? { program: { title: input.title } }
              : {},
          },
        },
      ),
    deleteRecording: (id: number) =>
      call<unknown>(`/api/channels/recordings/${id}/`, 'apagar a gravação', {
        method: 'DELETE',
      }),
    settings: () =>
      call<unknown[] | Page<unknown>>(
        '/api/core/settings/',
        'as definições',
      ).then((body) => (Array.isArray(body) ? body : unwrap(body))),
    backups: () =>
      call<DispatcharrBackup[]>('/api/backups/', 'os backups').then((body) =>
        Array.isArray(body) ? body : [],
      ),
    backupSchedule: () =>
      call<Record<string, unknown>>(
        '/api/backups/schedule/',
        'o horário dos backups',
      ),
    startBackup,
    backupStatus,
    createBackup,
    /** O zip em stream, sem o carregar todo para a memória. */
    async downloadBackup(filename: string) {
      const response = await send(
        `${root}/api/backups/${encodeURIComponent(filename)}/download/`,
        { headers: { 'X-API-Key': apiKey } },
        'descarregar o backup',
        0,
      );
      if (!response.body) throw new Error('o Dispatcharr não mandou o zip');
      const length = Number(response.headers.get('content-length'));
      return {
        stream: Readable.fromWeb(response.body as WebReadableStream),
        size: Number.isFinite(length) && length > 0 ? length : null,
      };
    },
    deleteBackup: (filename: string) =>
      call<unknown>(
        `/api/backups/${encodeURIComponent(filename)}/delete/`,
        'apagar o backup',
        { method: 'DELETE' },
      ),
  };
}

export type DispatcharrClient = ReturnType<typeof createDispatcharrClient>;
