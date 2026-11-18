import axios, { AxiosResponse } from 'axios';
import { Agent } from 'https';
import { AppIntegrationError } from 'src/integrations/app-integration.error';

// O Paperless-ngx (os documentos digitalizados, com OCR): a API REST em <endereço>/api, com
// o token de Perfil → Token de autenticação da API no cabeçalho "Authorization: Token …".
// O token age como quem o criou, com as permissões dele; de um superutilizador chega
// também à configuração da aplicação (/api/config) e ao estado do sistema (/api/status).

/** O repositório das releases (as notas e as issues das atualizações). */
export const PAPERLESS_REPOSITORY = 'paperless-ngx/paperless-ngx';

/** A versão da API que se pede (a 10 é a da interface do Paperless 3.x; a 9 também serve). */
const API_VERSION = '9';

/** Como o Paperless associa sozinho uma etiqueta, um correspondente ou um tipo. */
export const PAPERLESS_MATCHING = [
  'none',
  'any',
  'all',
  'literal',
  'regex',
  'fuzzy',
  'auto',
] as const;
export type PaperlessMatching = (typeof PAPERLESS_MATCHING)[number];

export const PAPERLESS_OBJECTS = [
  'tags',
  'correspondents',
  'document_types',
  'storage_paths',
] as const;
export type PaperlessObjectKind = (typeof PAPERLESS_OBJECTS)[number];

export interface PaperlessUser {
  id: number;
  username: string;
  is_staff: boolean;
  is_superuser: boolean;
}

export interface PaperlessDocument {
  id: number;
  title: string;
  content?: string;
  tags: number[];
  correspondent: number | null;
  document_type: number | null;
  storage_path: number | null;
  created: string;
  added?: string;
  modified?: string;
  archive_serial_number: number | null;
  original_file_name?: string | null;
  page_count?: number | null;
  mime_type?: string;
  notes?: { id: number; note: string; created: string }[];
  custom_fields?: { field: number; value: unknown }[];
  __search_hit__?: { score?: number; highlights?: string } | null;
}

export interface PaperlessObject {
  id: number;
  name: string;
  document_count?: number;
  matching_algorithm?: number;
  match?: string;
  is_inbox_tag?: boolean;
  color?: string;
  path?: string;
  data_type?: string;
}

export interface PaperlessStatistics {
  documents_total: number;
  documents_inbox: number | null;
  character_count?: number;
  tag_count?: number;
  correspondent_count?: number;
  document_type_count?: number;
  storage_path_count?: number;
  current_asn?: number | null;
  document_file_type_counts?: { mime_type: string; mime_type_count: number }[];
}

export interface PaperlessStatus {
  pngx_version: string;
  storage: { total: number; available: number };
  database: {
    status: string;
    error: string | null;
    migration_status?: { unapplied_migrations: string[] };
  };
  tasks: {
    redis_status: string;
    celery_status: string;
    index_status: string;
    index_last_modified: string | null;
    classifier_status: string;
    classifier_last_trained: string | null;
    sanity_check_status: string;
    sanity_check_last_run: string | null;
    sanity_check_error?: string | null;
  };
}

export interface PaperlessTask {
  id: number;
  task_file_name: string | null;
  date_created: string;
  date_done: string | null;
  type: string;
  status: string;
  result: string | null;
  related_document: string | null;
  acknowledged: boolean;
}

export interface PaperlessDocumentFilter {
  query?: string;
  titleContent?: string;
  tags?: number[];
  correspondent?: number;
  documentType?: number;
  storagePath?: number;
  createdAfter?: string;
  createdBefore?: string;
  inbox?: boolean;
  pageSize?: number;
}

export type PaperlessBulkMethod =
  | 'add_tag'
  | 'remove_tag'
  | 'modify_tags'
  | 'set_correspondent'
  | 'set_document_type'
  | 'set_storage_path';

const httpsAgent = new Agent({ rejectUnauthorized: false });

export const normalizePaperlessUrl = (url: string) =>
  url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');

function failure(error: unknown, what: string): AppIntegrationError {
  if (error instanceof AppIntegrationError) return error;
  if (axios.isAxiosError(error) && error.response) {
    const status = error.response.status;
    const body = error.response.data as
      | { detail?: unknown; error?: unknown }
      | Record<string, unknown>
      | string
      | undefined;
    const message =
      typeof body === 'string'
        ? body.slice(0, 200)
        : body && typeof body === 'object'
          ? typeof body.detail === 'string'
            ? body.detail
            : typeof body.error === 'string'
              ? body.error
              : JSON.stringify(body).slice(0, 300)
          : '';
    if (status === 401) {
      return new AppIntegrationError(
        'APP_AUTH_FAILED',
        'O Paperless recusou o token (foi trocado ou não existe). Gera outro em Perfil → Token de autenticação da API.',
      );
    }
    if (status === 403) {
      return new AppIntegrationError(
        'APP_AUTH_FAILED',
        `O Paperless não deixou (${what})${message ? `: ${message}` : ''}. O utilizador do token não tem essa permissão (a configuração e o estado do sistema são só de superutilizadores).`,
      );
    }
    return new AppIntegrationError(
      status === 404 ? 'APP_NOT_SUPPORTED' : 'APP_UNREACHABLE',
      `O Paperless respondeu ${status} em ${what}${message ? `: ${message}` : ''}`,
    );
  }
  return new AppIntegrationError(
    'APP_UNREACHABLE',
    `Não foi possível falar com o Paperless: ${error instanceof Error ? error.message : String(error)}`,
  );
}

const headerVersion = (response: AxiosResponse) => {
  const value = response.headers['x-version'] as string | undefined;
  return value ? `v${value.replace(/^v/, '')}` : null;
};

export function createPaperlessClient(baseUrl: string, token: string) {
  const http = axios.create({
    baseURL: `${normalizePaperlessUrl(baseUrl)}/api`,
    httpsAgent,
    timeout: 30_000,
    headers: {
      Authorization: `Token ${token}`,
      Accept: `application/json; version=${API_VERSION}`,
    },
  });
  const call = async <T>(what: string, run: () => Promise<{ data: T }>) => {
    try {
      return (await run()).data;
    } catch (error) {
      throw failure(error, what);
    }
  };
  /** Todas as páginas de uma lista (o Paperless pagina com "next"). */
  const listAll = async <T>(
    path: string,
    params: Record<string, unknown> = {},
  ) => {
    const items: T[] = [];
    let page = 1;
    for (;;) {
      const data = await call(path, () =>
        http.get<{ results: T[]; next: string | null }>(path, {
          params: { page_size: 1000, ...params, page },
        }),
      );
      items.push(...data.results);
      if (!data.next || page >= 50) return items;
      page += 1;
    }
  };

  return {
    /** Quem é o token e a versão (o cabeçalho X-Version vem em qualquer resposta com login). */
    me: async () => {
      try {
        const response = await http.get<{
          user: PaperlessUser;
          permissions?: string[];
        }>('/ui_settings/');
        return {
          user: response.data.user,
          permissions: response.data.permissions ?? [],
          version: headerVersion(response),
        };
      } catch (error) {
        throw failure(error, '/ui_settings');
      }
    },
    statistics: () =>
      call('/statistics', () => http.get<PaperlessStatistics>('/statistics/')),
    /** O ficheiro de um documento (o original, não o arquivado com OCR, se `original`). */
    download: async (id: number, original = false) => {
      try {
        const response = await http.get<ArrayBuffer>(
          `/documents/${id}/download/`,
          {
            params: original ? { original: true } : undefined,
            responseType: 'arraybuffer',
            timeout: 120_000,
          },
        );
        const disposition = String(
          response.headers['content-disposition'] ?? '',
        );
        const match = disposition.match(/filename*?=(?:UTF-8'')?"?([^";]+)"?/i);
        return {
          name: match ? decodeURIComponent(match[1]) : `documento-${id}.pdf`,
          data: Buffer.from(response.data),
          contentType: String(
            response.headers['content-type'] ?? 'application/pdf',
          ).split(';')[0],
        };
      } catch (error) {
        throw failure(error, `/documents/${id}/download`);
      }
    },
    /** Envia um ficheiro novo (o Paperless processa-o em segundo plano); devolve o id da tarefa. */
    upload: async (
      file: { name: string; data: Buffer; contentType: string },
      title?: string,
    ) => {
      const form = new FormData();
      form.append(
        'document',
        new Blob([new Uint8Array(file.data)], { type: file.contentType }),
        file.name,
      );
      if (title) form.append('title', title);
      return call('/documents/post_document', () =>
        http.post<string>('/documents/post_document/', form, {
          timeout: 120_000,
          maxBodyLength: Infinity,
        }),
      );
    },
    status: () => call('/status', () => http.get<PaperlessStatus>('/status/')),
    tasks: () => call('/tasks', () => http.get<PaperlessTask[]>('/tasks/')),

    documents: async (filter: PaperlessDocumentFilter) => {
      const params: Record<string, unknown> = {
        page_size: Math.min(Math.max(filter.pageSize ?? 25, 1), 100),
        ordering: filter.query ? undefined : '-created',
        truncate_content: true,
      };
      if (filter.query) params.query = filter.query;
      if (filter.titleContent) params.title_content = filter.titleContent;
      if (filter.tags?.length) params.tags__id__all = filter.tags.join(',');
      if (filter.correspondent !== undefined) {
        params.correspondent__id = filter.correspondent;
      }
      if (filter.documentType !== undefined) {
        params.document_type__id = filter.documentType;
      }
      if (filter.storagePath !== undefined) {
        params.storage_path__id = filter.storagePath;
      }
      if (filter.createdAfter) params.created__date__gte = filter.createdAfter;
      if (filter.createdBefore)
        params.created__date__lte = filter.createdBefore;
      if (filter.inbox) params.is_in_inbox = true;
      return call('/documents', () =>
        http.get<{ count: number; results: PaperlessDocument[] }>(
          '/documents/',
          { params },
        ),
      );
    },
    document: (id: number) =>
      call('/documents/:id', () =>
        http.get<PaperlessDocument>(`/documents/${id}/`),
      ),
    updateDocument: (id: number, input: Partial<PaperlessDocument>) =>
      call('PATCH /documents/:id', () =>
        http.patch<PaperlessDocument>(`/documents/${id}/`, input),
      ),
    addNote: (id: number, note: string) =>
      call('POST /documents/:id/notes', () =>
        http.post(`/documents/${id}/notes/`, { note }),
      ),
    bulkEdit: (
      documents: number[],
      method: PaperlessBulkMethod,
      parameters: Record<string, unknown>,
    ) =>
      call('POST /documents/bulk_edit', () =>
        http.post('/documents/bulk_edit/', { documents, method, parameters }),
      ),

    objects: (kind: PaperlessObjectKind) =>
      listAll<PaperlessObject>(`/${kind}/`),
    customFields: () => listAll<PaperlessObject>('/custom_fields/'),
    createObject: (kind: PaperlessObjectKind, input: Record<string, unknown>) =>
      call(`POST /${kind}`, () =>
        http.post<PaperlessObject>(`/${kind}/`, input),
      ),
    updateObject: (
      kind: PaperlessObjectKind,
      id: number,
      input: Record<string, unknown>,
    ) =>
      call(`PATCH /${kind}/:id`, () =>
        http.patch<PaperlessObject>(`/${kind}/${id}/`, input),
      ),

    list: (path: string) => listAll<Record<string, unknown>>(path),

    config: async () => {
      const data = await call('/config', () =>
        http.get<Record<string, unknown>[]>('/config/'),
      );
      if (!data.length) {
        throw new AppIntegrationError(
          'APP_NOT_SUPPORTED',
          'O Paperless não devolveu a configuração da aplicação.',
        );
      }
      return data[0];
    },
    setConfig: (id: number, input: Record<string, unknown>) =>
      call('PATCH /config/:id', () =>
        http.patch<Record<string, unknown>>(`/config/${id}/`, input),
      ),
  };
}

export type PaperlessClient = ReturnType<typeof createPaperlessClient>;

/** A versão instalada (o X-Version de uma resposta com o token). */
export async function paperlessVersion(
  baseUrl: string,
  token: string,
): Promise<string> {
  const { version } = await createPaperlessClient(baseUrl, token).me();
  if (!version) {
    throw new AppIntegrationError(
      'APP_UNREACHABLE',
      'O Paperless não diz a versão (falta o cabeçalho X-Version).',
    );
  }
  return version;
}
