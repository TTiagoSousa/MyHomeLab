import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { describeFetchError } from 'src/integrations/app-fetch';

// O Jellyfin (servidor de filmes, séries e música): a API REST em <endereço>/…, com uma chave
// de API (Painel de controlo → Chaves de API) no cabeçalho Authorization: MediaBrowser
// Token="…". Desde a 10.11/12.0 a autorização antiga (X-Emby-Token, ?api_key=) vem desligada,
// por isso só se usa o Authorization. /System/Info/Public não pede chave e diz a versão.
// A API de backups (/Backup, desde a 10.11) cria o backup no disco do servidor mas não o deixa
// descarregar: o backup do MyHomeLab é um JSON com a configuração. Não há MCP no servidor.

export const JELLYFIN_REPOSITORY = 'jellyfin/jellyfin';

/** Tira o que se cola a mais: espaços, a barra do fim, um /web ou uma página do painel. */
export const normalizeJellyfinUrl = (url: string) =>
  url
    .trim()
    .replace(/[#?].*$/, '')
    .replace(/\/+$/, '')
    .replace(/\/web(\/.*)?$/i, '')
    .replace(/\/+$/, '');

export interface JellyfinPublicInfo {
  ServerName?: string;
  Version?: string;
  ProductName?: string;
  Id?: string;
  StartupWizardCompleted?: boolean;
}

export interface JellyfinSystemInfo extends JellyfinPublicInfo {
  OperatingSystemDisplayName?: string;
  HasPendingRestart?: boolean;
  HasUpdateAvailable?: boolean;
  IsShuttingDown?: boolean;
  WebSocketPortNumber?: number;
  CachePath?: string;
  LogPath?: string;
  TranscodingTempPath?: string;
}

export interface JellyfinVirtualFolder {
  Name: string;
  ItemId: string;
  CollectionType?: string;
  Locations?: string[];
  RefreshStatus?: string;
  RefreshProgress?: number | null;
  LibraryOptions?: Record<string, unknown>;
}

export interface JellyfinItemCounts {
  MovieCount?: number;
  SeriesCount?: number;
  EpisodeCount?: number;
  ArtistCount?: number;
  AlbumCount?: number;
  SongCount?: number;
  MusicVideoCount?: number;
  BoxSetCount?: number;
  BookCount?: number;
  ProgramCount?: number;
  TrailerCount?: number;
}

export interface JellyfinItem {
  Id: string;
  Name: string;
  Type: string;
  ProductionYear?: number;
  Overview?: string;
  Path?: string;
  SeriesName?: string;
  ParentIndexNumber?: number;
  IndexNumber?: number;
  RunTimeTicks?: number;
  CommunityRating?: number;
  OfficialRating?: string;
  Genres?: string[];
  DateCreated?: string;
  PremiereDate?: string;
  ProviderIds?: Record<string, string>;
  ChildCount?: number;
  RecursiveItemCount?: number;
  MediaSources?: {
    Container?: string;
    Size?: number;
    Bitrate?: number;
    MediaStreams?: {
      Type: string;
      Codec?: string;
      Language?: string;
      DisplayTitle?: string;
    }[];
  }[];
}

export interface JellyfinSession {
  Id: string;
  UserName?: string;
  UserId?: string;
  Client?: string;
  DeviceName?: string;
  RemoteEndPoint?: string;
  ApplicationVersion?: string;
  LastActivityDate?: string;
  NowPlayingItem?: {
    Id: string;
    Name: string;
    Type: string;
    SeriesName?: string;
    RunTimeTicks?: number;
  };
  PlayState?: {
    PositionTicks?: number;
    IsPaused?: boolean;
    PlayMethod?: string;
  };
  TranscodingInfo?: {
    IsVideoDirect?: boolean;
    IsAudioDirect?: boolean;
    VideoCodec?: string;
    AudioCodec?: string;
    TranscodeReasons?: string[];
  };
  SupportsRemoteControl?: boolean;
}

export interface JellyfinUserPolicy {
  IsAdministrator?: boolean;
  IsDisabled?: boolean;
  IsHidden?: boolean;
  EnableAllFolders?: boolean;
  EnableRemoteAccess?: boolean;
  AuthenticationProviderId?: string;
  PasswordResetProviderId?: string;
  [key: string]: unknown;
}

export interface JellyfinUser {
  Id: string;
  Name: string;
  HasPassword?: boolean;
  LastLoginDate?: string;
  LastActivityDate?: string;
  Policy?: JellyfinUserPolicy;
  Configuration?: Record<string, unknown>;
}

export interface JellyfinTask {
  Id: string;
  Name: string;
  Key?: string;
  Category?: string;
  State: string;
  CurrentProgressPercentage?: number | null;
  IsHidden?: boolean;
  LastExecutionResult?: {
    Status?: string;
    StartTimeUtc?: string;
    EndTimeUtc?: string;
    ErrorMessage?: string | null;
  };
  Triggers?: unknown[];
}

export interface JellyfinActivity {
  Id: number;
  Name: string;
  Overview?: string;
  ShortOverview?: string;
  Type?: string;
  Date: string;
  Severity?: string;
  UserId?: string;
}

export interface JellyfinPlugin {
  Id: string;
  Name: string;
  Version?: string;
  Status?: string;
  Description?: string;
  CanUninstall?: boolean;
}

export interface JellyfinBackupManifest {
  ServerVersion?: string;
  BackupEngineVersion?: string;
  DateCreated?: string;
  Path: string;
  Options?: {
    Metadata?: boolean;
    Trickplay?: boolean;
    Subtitles?: boolean;
    Database?: boolean;
  };
}

export interface JellyfinRefreshOptions {
  recursive?: boolean;
  replaceAllMetadata?: boolean;
  replaceAllImages?: boolean;
}

interface QueryResult<T> {
  Items?: T[];
  TotalRecordCount?: number;
}

/** O cabeçalho de autorização do Jellyfin com a chave de API. */
export const jellyfinAuthorization = (apiKey: string) =>
  `MediaBrowser Client="MyHomeLab", Device="MyHomeLab", DeviceId="myhomelab", Version="1.0.0", Token="${apiKey}"`;

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
      `Não foi possível falar com o Jellyfin (${what}): ${describeFetchError(error)}`,
    );
  }
  const text = await response.text();
  if (!response.ok) {
    if (response.status === 401) {
      throw new AppIntegrationError(
        'APP_AUTH_FAILED',
        'O Jellyfin recusou a chave de API (apagada ou errada). Cria outra em Painel de controlo → Chaves de API.',
      );
    }
    if (response.status === 403) {
      throw new Error(
        `o Jellyfin não deixa fazer isto com esta chave (${what})`,
      );
    }
    let detail = text.slice(0, 300);
    try {
      const body = JSON.parse(text) as Record<string, unknown>;
      detail =
        typeof body.detail === 'string'
          ? body.detail
          : typeof body.title === 'string'
            ? body.title
            : JSON.stringify(body).slice(0, 300);
    } catch {
      /* fica o texto */
    }
    throw new Error(
      response.status === 404
        ? `o Jellyfin não encontrou isso (${what})`
        : `o Jellyfin respondeu ${response.status} (${what}): ${detail}`,
    );
  }
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `a resposta do Jellyfin não é JSON (${what}): este endereço é mesmo um Jellyfin?`,
    );
  }
}

/** A informação pública (sem chave): o nome do servidor e a versão. */
export async function jellyfinPublicInfo(baseUrl: string) {
  const info = await request<JellyfinPublicInfo>(
    `${normalizeJellyfinUrl(baseUrl)}/System/Info/Public`,
    {},
    'a informação pública',
  );
  if (!info.Version || !info.Id) {
    throw new Error('este endereço não é um Jellyfin (não diz a versão)');
  }
  return info;
}

/** A versão instalada, para as atualizações ("v10.11.2", "v12.4.0"). */
export async function jellyfinVersion(baseUrl: string) {
  const { Version } = await jellyfinPublicInfo(baseUrl);
  if (!Version) throw new Error('O Jellyfin não disse a versão.');
  return `v${Version.replace(/^v/, '')}`;
}

const TICKS_PER_SECOND = 10_000_000;

/** "1:32:05" a partir dos ticks do Jellyfin (100 ns). */
export function jellyfinDuration(ticks?: number | null) {
  if (!ticks) return '';
  const total = Math.round(ticks / TICKS_PER_SECOND);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

export function createJellyfinClient(baseUrl: string, apiKey: string) {
  const root = normalizeJellyfinUrl(baseUrl);
  const call = <T>(
    path: string,
    what: string,
    init: { method?: string; body?: unknown } = {},
  ) =>
    request<T>(
      `${root}${path}`,
      {
        method: init.method ?? 'GET',
        headers: {
          Authorization: jellyfinAuthorization(apiKey),
          Accept: 'application/json',
          ...(init.body !== undefined
            ? { 'Content-Type': 'application/json' }
            : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      },
      what,
    );
  const id = (value: string) => encodeURIComponent(value);
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

  return {
    info: () => call<JellyfinSystemInfo>('/System/Info', 'o servidor'),
    configuration: () =>
      call<Record<string, unknown>>('/System/Configuration', 'a configuração'),
    namedConfiguration: (key: string) =>
      call<Record<string, unknown>>(
        `/System/Configuration/${id(key)}`,
        `a configuração ${key}`,
      ),
    libraries: () =>
      call<JellyfinVirtualFolder[]>(
        '/Library/VirtualFolders',
        'as bibliotecas',
      ),
    counts: () => call<JellyfinItemCounts>('/Items/Counts', 'as contagens'),
    /** Quantos itens há debaixo de uma biblioteca (pasta). */
    countIn: (parentId: string) =>
      call<QueryResult<JellyfinItem>>(
        `/Items?${query({ ParentId: parentId, Recursive: true, Limit: 0, IsFolder: false })}`,
        'a contagem da biblioteca',
      ).then((body) => body.TotalRecordCount ?? 0),
    /** Procura no servidor todo; types são os tipos do Jellyfin (Movie, Series, Episode, …). */
    search: (
      text: string,
      options: { types?: string[]; parentId?: string; limit?: number } = {},
    ) =>
      call<QueryResult<JellyfinItem>>(
        `/Items?${query({
          searchTerm: text,
          Recursive: true,
          IncludeItemTypes: options.types?.join(','),
          ParentId: options.parentId,
          Limit: options.limit ?? 25,
          Fields: 'ProductionYear,Path,ProviderIds',
        })}`,
        'a pesquisa',
      ).then((body) => ({
        items: body.Items ?? [],
        total: body.TotalRecordCount ?? 0,
      })),
    /** Os mais recentes adicionados (DateCreated). */
    latest: (limit = 20, parentId?: string) =>
      call<QueryResult<JellyfinItem>>(
        `/Items?${query({
          Recursive: true,
          SortBy: 'DateCreated',
          SortOrder: 'Descending',
          IncludeItemTypes: 'Movie,Episode,MusicAlbum,Series',
          ParentId: parentId,
          Limit: limit,
          Fields: 'ProductionYear,DateCreated',
        })}`,
        'os mais recentes',
      ).then((body) => body.Items ?? []),
    item: (itemId: string) =>
      call<QueryResult<JellyfinItem>>(
        `/Items?${query({
          Ids: itemId,
          Fields:
            'Overview,Path,Genres,ProviderIds,MediaSources,DateCreated,PremiereDate,ChildCount,RecursiveItemCount,OfficialRating',
        })}`,
        'o item',
      ).then((body) => {
        const found = body.Items?.[0];
        if (!found) throw new Error('o Jellyfin não encontrou esse item');
        return found;
      }),
    /** Procura bibliotecas e itens novos em todas as bibliotecas. */
    scanAll: () =>
      call<unknown>('/Library/Refresh', 'procurar nas bibliotecas', {
        method: 'POST',
      }),
    /** Atualiza uma biblioteca ou um item (metadados e imagens). */
    refresh: (itemId: string, options: JellyfinRefreshOptions = {}) => {
      const full = Boolean(
        options.replaceAllMetadata || options.replaceAllImages,
      );
      return call<unknown>(
        `/Items/${id(itemId)}/Refresh?${query({
          Recursive: options.recursive ?? true,
          MetadataRefreshMode: full ? 'FullRefresh' : 'Default',
          ImageRefreshMode: full ? 'FullRefresh' : 'Default',
          ReplaceAllMetadata: Boolean(options.replaceAllMetadata),
          ReplaceAllImages: Boolean(options.replaceAllImages),
        })}`,
        'atualizar',
        { method: 'POST' },
      );
    },
    sessions: (activeWithinSeconds = 960) =>
      call<JellyfinSession[]>(
        `/Sessions?${query({ ActiveWithinSeconds: activeWithinSeconds })}`,
        'as sessões',
      ),
    sendMessage: (sessionId: string, header: string, text: string) =>
      call<unknown>(`/Sessions/${id(sessionId)}/Message`, 'a mensagem', {
        method: 'POST',
        body: { Header: header, Text: text, TimeoutMs: 15_000 },
      }),
    playback: (sessionId: string, command: 'Stop' | 'Pause' | 'Unpause') =>
      call<unknown>(
        `/Sessions/${id(sessionId)}/Playing/${command}`,
        `o comando ${command}`,
        { method: 'POST' },
      ),
    users: () => call<JellyfinUser[]>('/Users', 'os utilizadores'),
    user: (userId: string) =>
      call<JellyfinUser>(`/Users/${id(userId)}`, 'o utilizador'),
    createUser: (name: string, password?: string) =>
      call<JellyfinUser>('/Users/New', 'criar o utilizador', {
        method: 'POST',
        body: { Name: name, ...(password ? { Password: password } : {}) },
      }),
    setPolicy: (userId: string, policy: JellyfinUserPolicy) =>
      call<unknown>(`/Users/${id(userId)}/Policy`, 'mudar o utilizador', {
        method: 'POST',
        body: policy,
      }),
    deleteUser: (userId: string) =>
      call<unknown>(`/Users/${id(userId)}`, 'apagar o utilizador', {
        method: 'DELETE',
      }),
    tasks: () =>
      call<JellyfinTask[]>(
        '/ScheduledTasks?IsHidden=false',
        'as tarefas agendadas',
      ),
    startTask: (taskId: string) =>
      call<unknown>(
        `/ScheduledTasks/Running/${id(taskId)}`,
        'começar a tarefa',
        { method: 'POST' },
      ),
    stopTask: (taskId: string) =>
      call<unknown>(`/ScheduledTasks/Running/${id(taskId)}`, 'parar a tarefa', {
        method: 'DELETE',
      }),
    activity: (limit = 25, minDate?: string) =>
      call<QueryResult<JellyfinActivity>>(
        `/System/ActivityLog/Entries?${query({ startIndex: 0, limit, minDate })}`,
        'o registo de atividade',
      ).then((body) => body.Items ?? []),
    plugins: () => call<JellyfinPlugin[]>('/Plugins', 'os plugins'),
    restart: () =>
      call<unknown>('/System/Restart', 'reiniciar', { method: 'POST' }),
    /** Os backups do próprio Jellyfin (10.11+), no disco do servidor. */
    serverBackups: () =>
      call<JellyfinBackupManifest[]>('/Backup', 'os backups do servidor'),
    createServerBackup: (options: {
      metadata?: boolean;
      trickplay?: boolean;
      subtitles?: boolean;
    }) =>
      call<JellyfinBackupManifest>('/Backup/Create', 'criar o backup', {
        method: 'POST',
        body: {
          Database: true,
          Metadata: Boolean(options.metadata),
          Trickplay: Boolean(options.trickplay),
          Subtitles: Boolean(options.subtitles),
        },
      }),
  };
}

export type JellyfinClient = ReturnType<typeof createJellyfinClient>;
