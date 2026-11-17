import axios from 'axios';
import { Agent } from 'https';
import { AppIntegrationError } from 'src/integrations/app-integration.error';

// O Immich (as fotos e os vídeos self-hosted): a API REST em <endereço>/api, com uma
// chave de API (Conta → Chaves de API) no cabeçalho x-api-key. A chave age como quem a
// criou e só tem as permissões escolhidas ao criá-la; de um admin com "all" chega também
// às definições do servidor, às filas de tarefas, às estatísticas e aos backups.

/** O repositório das releases (as notas e as issues das atualizações). */
export const IMMICH_REPOSITORY = 'immich-app/immich';

/** As filas de tarefas do Immich (Administração → Tarefas). */
export const IMMICH_QUEUES = [
  'thumbnailGeneration',
  'metadataExtraction',
  'videoConversion',
  'faceDetection',
  'facialRecognition',
  'smartSearch',
  'duplicateDetection',
  'backgroundTask',
  'storageTemplateMigration',
  'migration',
  'search',
  'sidecar',
  'library',
  'notifications',
  'backupDatabase',
  'ocr',
] as const;
export type ImmichQueue = (typeof IMMICH_QUEUES)[number];

/** As tarefas que se lançam à mão (POST /jobs). */
export const IMMICH_MANUAL_JOBS = [
  'backup-database',
  'person-cleanup',
  'tag-cleanup',
  'user-cleanup',
  'memory-cleanup',
  'memory-create',
] as const;
export type ImmichManualJob = (typeof IMMICH_MANUAL_JOBS)[number];

export interface ImmichMe {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

export interface ImmichApiKey {
  id: string;
  name: string;
  permissions: string[];
}

export interface ImmichStorage {
  diskSize: string;
  diskUse: string;
  diskAvailable: string;
  diskUsagePercentage: number;
}

export interface ImmichStatistics {
  photos: number;
  videos: number;
  usage: number;
  usageByUser: {
    userId: string;
    userName: string;
    photos: number;
    videos: number;
    usage: number;
    quotaSizeInBytes: number | null;
  }[];
}

export interface ImmichQueueStatus {
  name: string;
  isPaused: boolean;
  statistics: {
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    waiting: number;
  };
}

export interface ImmichAlbum {
  id: string;
  albumName: string;
  description: string;
  assetCount: number;
  shared: boolean;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
  updatedAt: string;
  owner?: { name: string };
  assets?: ImmichAsset[];
}

export interface ImmichAsset {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'OTHER';
  originalFileName: string;
  fileCreatedAt?: string;
  localDateTime?: string;
  isFavorite?: boolean;
  visibility?: string;
  exifInfo?: {
    city?: string | null;
    country?: string | null;
    make?: string | null;
    model?: string | null;
  } | null;
  people?: { id: string; name: string }[];
}

export interface ImmichPerson {
  id: string;
  name: string;
  birthDate?: string | null;
  isHidden: boolean;
  isFavorite?: boolean;
}

export interface ImmichBackup {
  filename: string;
  filesize: number;
}

export interface ImmichSearchFilter {
  query?: string;
  takenAfter?: string;
  takenBefore?: string;
  city?: string;
  country?: string;
  type?: 'IMAGE' | 'VIDEO';
  isFavorite?: boolean;
  personIds?: string[];
  originalFileName?: string;
  size?: number;
}

const httpsAgent = new Agent({ rejectUnauthorized: false });

export const normalizeImmichUrl = (url: string) =>
  url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');

function failure(error: unknown, what: string): AppIntegrationError {
  if (error instanceof AppIntegrationError) return error;
  if (axios.isAxiosError(error) && error.response) {
    const status = error.response.status;
    const body = error.response.data as { message?: unknown } | undefined;
    const message = Array.isArray(body?.message)
      ? body.message.join('; ')
      : typeof body?.message === 'string'
        ? body.message
        : '';
    if (status === 401) {
      return new AppIntegrationError(
        'APP_AUTH_FAILED',
        'O Immich recusou a chave de API (foi apagada ou está errada). Cria outra em Conta → Chaves de API.',
      );
    }
    if (status === 403) {
      return new AppIntegrationError(
        'APP_AUTH_FAILED',
        `O Immich não deixou (${what})${message ? `: ${message}` : ''}. A chave não tem essa permissão, ou é preciso um admin: cria-a com "all" numa conta admin.`,
      );
    }
    return new AppIntegrationError(
      status === 404 ? 'APP_NOT_SUPPORTED' : 'APP_UNREACHABLE',
      `O Immich respondeu ${status} em ${what}${message ? `: ${message}` : ''}`,
    );
  }
  return new AppIntegrationError(
    'APP_UNREACHABLE',
    `Não foi possível falar com o Immich: ${error instanceof Error ? error.message : String(error)}`,
  );
}

/** A versão instalada, sem chave (/api/server/version, público): "v3.4.1". */
export async function immichVersion(baseUrl: string): Promise<string> {
  try {
    const { data } = await axios.get<{
      major?: number;
      minor?: number;
      patch?: number;
    }>(`${normalizeImmichUrl(baseUrl)}/api/server/version`, {
      httpsAgent,
      timeout: 15_000,
    });
    if (typeof data?.major !== 'number') {
      throw new AppIntegrationError(
        'APP_UNREACHABLE',
        'Este endereço não é um Immich (o /api/server/version não o diz).',
      );
    }
    return `v${data.major}.${data.minor ?? 0}.${data.patch ?? 0}`;
  } catch (error) {
    throw failure(error, '/server/version');
  }
}

export function createImmichClient(baseUrl: string, apiKey: string) {
  const http = axios.create({
    baseURL: `${normalizeImmichUrl(baseUrl)}/api`,
    httpsAgent,
    timeout: 30_000,
    headers: { 'x-api-key': apiKey, Accept: 'application/json' },
  });
  const call = async <T>(what: string, run: () => Promise<{ data: T }>) => {
    try {
      return (await run()).data;
    } catch (error) {
      throw failure(error, what);
    }
  };

  return {
    me: () => call('/users/me', () => http.get<ImmichMe>('/users/me')),
    apiKey: () =>
      call('/api-keys/me', () => http.get<ImmichApiKey>('/api-keys/me')),
    storage: () =>
      call('/server/storage', () => http.get<ImmichStorage>('/server/storage')),
    statistics: () =>
      call('/server/statistics', () =>
        http.get<ImmichStatistics>('/server/statistics'),
      ),
    myStatistics: () =>
      call('/assets/statistics', () =>
        http.get<{ images: number; videos: number; total: number }>(
          '/assets/statistics',
        ),
      ),

    queues: () =>
      call('/queues', () => http.get<ImmichQueueStatus[]>('/queues')),
    setQueuePaused: (name: ImmichQueue, isPaused: boolean) =>
      call('PUT /queues/:name', () =>
        http.put<ImmichQueueStatus>(`/queues/${name}`, { isPaused }),
      ),
    // O PUT /jobs/:name está marcado como obsoleto desde a v2.4, mas é o único que corre
    // uma fila inteira ("Correr tudo" / "Em falta" na página das tarefas).
    startQueue: (name: ImmichQueue, force: boolean) =>
      call('PUT /jobs/:name', () =>
        http.put(`/jobs/${name}`, { command: 'start', force }),
      ),
    runJob: (name: ImmichManualJob) =>
      call('POST /jobs', () => http.post('/jobs', { name })),

    config: () =>
      call('/system-config', () =>
        http.get<Record<string, unknown>>('/system-config'),
      ),
    setConfig: (config: Record<string, unknown>) =>
      call('PUT /system-config', () =>
        http.put<Record<string, unknown>>('/system-config', config),
      ),

    albums: () => call('/albums', () => http.get<ImmichAlbum[]>('/albums')),
    album: (id: string) =>
      call('/albums/:id', () => http.get<ImmichAlbum>(`/albums/${id}`)),
    createAlbum: (input: {
      albumName: string;
      description?: string;
      assetIds?: string[];
    }) => call('POST /albums', () => http.post<ImmichAlbum>('/albums', input)),
    updateAlbum: (
      id: string,
      input: { albumName?: string; description?: string },
    ) =>
      call('PATCH /albums/:id', () =>
        http.patch<ImmichAlbum>(`/albums/${id}`, input),
      ),
    addToAlbum: (id: string, ids: string[]) =>
      call('PUT /albums/:id/assets', () =>
        http.put<{ id: string; success: boolean; error?: string }[]>(
          `/albums/${id}/assets`,
          { ids },
        ),
      ),
    removeFromAlbum: (id: string, ids: string[]) =>
      call('DELETE /albums/:id/assets', () =>
        http.delete<{ id: string; success: boolean; error?: string }[]>(
          `/albums/${id}/assets`,
          { data: { ids } },
        ),
      ),

    people: () =>
      call('/people', () =>
        http.get<{ people: ImmichPerson[]; total: number; hidden: number }>(
          '/people',
          { params: { withHidden: true, size: 500 } },
        ),
      ),
    updatePerson: (
      id: string,
      input: { name?: string; birthDate?: string | null; isHidden?: boolean },
    ) =>
      call('PUT /people/:id', () =>
        http.put<ImmichPerson>(`/people/${id}`, input),
      ),

    // Com texto, a pesquisa inteligente (CLIP: "praia ao pôr do sol"); sem texto, pelos
    // metadados (datas, sítio, pessoas, favoritos).
    search: ({ query, ...filter }: ImmichSearchFilter) =>
      call(query ? 'POST /search/smart' : 'POST /search/metadata', () =>
        http.post<{
          assets: { total: number; count: number; items: ImmichAsset[] };
        }>(
          query ? '/search/smart' : '/search/metadata',
          query ? { query, ...filter } : filter,
        ),
      ),
    duplicates: () =>
      call('/duplicates', () =>
        http.get<{ duplicateId: string; assets: ImmichAsset[] }[]>(
          '/duplicates',
        ),
      ),

    backups: () =>
      call('/admin/database-backups', () =>
        http.get<{ backups: ImmichBackup[] }>('/admin/database-backups'),
      ),
    downloadBackup: (filename: string) =>
      call('/admin/database-backups/:filename', () =>
        http.get<ArrayBuffer>(
          `/admin/database-backups/${encodeURIComponent(filename)}`,
          { responseType: 'arraybuffer', timeout: 600_000 },
        ),
      ),
  };
}

export type ImmichClient = ReturnType<typeof createImmichClient>;
