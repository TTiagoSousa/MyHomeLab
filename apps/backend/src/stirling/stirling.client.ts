import axios from 'axios';
import { Agent } from 'https';
import { AppIntegrationError } from 'src/integrations/app-integration.error';

// O Stirling-PDF (as ferramentas de PDF): a API REST em <endereço>/api/v1, com a chave de API
// da conta (Definições da conta → Chave de API) no cabeçalho "X-API-KEY". As operações são
// todas POST multipart (o ficheiro em "fileInput" e os parâmetros como campos); a lista e os
// parâmetros de cada uma vêm do OpenAPI do próprio Stirling (/v1/api-docs). As definições do
// servidor (/api/v1/admin/settings) só respondem a uma chave de administrador. Com o MCP
// ligado no servidor (mcp.enabled), há também <endereço>/mcp com a mesma chave.

/** O repositório das releases (as notas e as issues das atualizações). */
export const STIRLING_REPOSITORY = 'Stirling-Tools/Stirling-PDF';

const httpsAgent = new Agent({ rejectUnauthorized: false });

/** Tira o que se cola a mais: espaços, a barra do fim e um /api colado. */
export const normalizeStirlingUrl = (url: string) =>
  url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api(\/v1)?$/i, '');

export interface StirlingStatus {
  status: string;
  version: string;
}

/** Um parâmetro de uma operação, lido do OpenAPI. */
export interface StirlingParameter {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  enum?: string[];
  default?: unknown;
  /** Um ficheiro (ex.: fileInput); `many` = aceita vários. */
  file?: { many: boolean };
}

export interface StirlingOperation {
  /** O caminho sem /api/v1, ex.: "misc/compress-pdf". */
  path: string;
  tag: string;
  summary: string;
  description?: string;
  parameters: StirlingParameter[];
}

export interface StirlingFile {
  name: string;
  data: Buffer;
  contentType: string;
}

/** O que uma operação devolve: um ficheiro (PDF, ZIP, imagem…) ou texto/JSON. */
export type StirlingResult =
  { kind: 'file'; file: StirlingFile } | { kind: 'text'; text: string };

function failure(error: unknown, what: string): AppIntegrationError {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return new AppIntegrationError(
        'APP_UNREACHABLE',
        `Não foi possível falar com o Stirling-PDF (${what}): ${error.message}`,
      );
    }
    const status = error.response.status;
    const raw: unknown = error.response.data;
    const body =
      raw instanceof Buffer || raw instanceof ArrayBuffer
        ? Buffer.from(raw as ArrayBuffer).toString('utf8')
        : raw;
    const message =
      typeof body === 'string'
        ? body.slice(0, 300)
        : body && typeof body === 'object'
          ? ((picked) =>
              typeof picked === 'string'
                ? picked
                : JSON.stringify(body).slice(0, 300))(
              (body as Record<string, unknown>).message ??
                (body as Record<string, unknown>).error,
            )
          : '';
    if (status === 401) {
      return new AppIntegrationError(
        'APP_AUTH_FAILED',
        'O Stirling-PDF recusou a chave de API (foi trocada ou o login está desligado). Gera outra em Definições da conta → Chave de API.',
      );
    }
    if (status === 403) {
      return new AppIntegrationError(
        'APP_AUTH_FAILED',
        `O Stirling-PDF não deixou (${what})${message ? `: ${message}` : ''}. As definições do servidor precisam de uma chave de administrador.`,
      );
    }
    return new AppIntegrationError(
      status === 404 ? 'APP_NOT_SUPPORTED' : 'APP_UNREACHABLE',
      `O Stirling-PDF respondeu ${status} em ${what}${message ? `: ${message}` : ''}`,
    );
  }
  return new AppIntegrationError(
    'APP_UNREACHABLE',
    `Não foi possível falar com o Stirling-PDF: ${error instanceof Error ? error.message : String(error)}`,
  );
}

type Schema = {
  type?: string;
  format?: string;
  description?: string;
  enum?: unknown[];
  default?: unknown;
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  $ref?: string;
  allOf?: Schema[];
};

interface OpenApi {
  paths?: Record<
    string,
    Record<
      string,
      {
        tags?: string[];
        summary?: string;
        description?: string;
        requestBody?: { content?: Record<string, { schema?: Schema }> };
      }
    >
  >;
  components?: { schemas?: Record<string, Schema> };
}

/** As operações do OpenAPI: os POST multipart de /api/v1 (fora a administração e o login). */
export function operationsOf(spec: OpenApi): StirlingOperation[] {
  const schemas = spec.components?.schemas ?? {};
  const resolve = (schema: Schema | undefined, depth = 0): Schema => {
    if (!schema || depth > 6) return {};
    if (schema.$ref) {
      return resolve(schemas[schema.$ref.split('/').pop() ?? ''], depth + 1);
    }
    if (schema.allOf?.length) {
      const parts = schema.allOf.map((part) => resolve(part, depth + 1));
      return {
        type: 'object',
        properties: parts.reduce<Record<string, Schema>>(
          (all, part) => ({ ...all, ...(part.properties ?? {}) }),
          {},
        ),
        required: parts.flatMap((part) => part.required ?? []),
      };
    }
    return schema;
  };
  const operations: StirlingOperation[] = [];
  for (const [fullPath, methods] of Object.entries(spec.paths ?? {})) {
    const post = methods.post;
    if (!post || !fullPath.startsWith('/api/v1/')) continue;
    const path = fullPath.slice('/api/v1/'.length);
    if (
      /^(admin|auth|user|settings|proprietary|security\/(login|logout))/.test(
        path,
      )
    )
      continue;
    const multipart = post.requestBody?.content?.['multipart/form-data'];
    if (!multipart) continue;
    const schema = resolve(multipart.schema);
    const required = new Set(schema.required ?? []);
    const parameters = Object.entries(schema.properties ?? {}).map(
      ([name, raw]): StirlingParameter => {
        const field = resolve(raw);
        const isFile =
          field.format === 'binary' ||
          (field.type === 'array' && resolve(field.items).format === 'binary');
        return {
          name,
          type: field.type ?? 'string',
          required: required.has(name),
          description: field.description?.slice(0, 300),
          enum: field.enum?.map(String),
          default: field.default,
          ...(isFile ? { file: { many: field.type === 'array' } } : {}),
        };
      },
    );
    operations.push({
      path,
      tag: post.tags?.[0] ?? path.split('/')[0],
      summary: (post.summary ?? path).slice(0, 200),
      description: post.description?.slice(0, 600),
      parameters,
    });
  }
  return operations.sort((a, b) => a.path.localeCompare(b.path));
}

const fileName = (disposition: string | undefined, fallback: string) => {
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return match ? decodeURIComponent(match[1]) : fallback;
};

export function createStirlingClient(baseUrl: string, apiKey: string) {
  const root = normalizeStirlingUrl(baseUrl);
  const http = axios.create({
    baseURL: root,
    httpsAgent,
    timeout: 60_000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    headers: { 'X-API-KEY': apiKey },
  });
  const call = async <T>(what: string, run: () => Promise<{ data: T }>) => {
    try {
      return (await run()).data;
    } catch (error) {
      throw failure(error, what);
    }
  };

  return {
    status: () =>
      call('/api/v1/info/status', () =>
        http.get<StirlingStatus>('/api/v1/info/status'),
      ),
    /** O OpenAPI do Stirling, já como a lista das operações. */
    operations: async () =>
      operationsOf(
        await call('/v1/api-docs', () =>
          http.get<OpenApi>('/v1/api-docs', { timeout: 60_000 }),
        ),
      ),
    /** As operações desligadas no servidor (ENDPOINTS_TO_REMOVE / GROUPS_TO_REMOVE). */
    disabledEndpoints: () =>
      call('/api/v1/settings/get-endpoints-status', () =>
        http.get<Record<string, boolean>>(
          '/api/v1/settings/get-endpoints-status',
        ),
      ),
    /** Corre uma operação: os ficheiros e os campos em multipart. */
    run: async (
      path: string,
      fields: Record<string, unknown>,
      files: { field: string; file: StirlingFile }[],
    ): Promise<StirlingResult> => {
      const form = new FormData();
      for (const { field, file } of files) {
        form.append(
          field,
          new Blob([new Uint8Array(file.data)], { type: file.contentType }),
          file.name,
        );
      }
      for (const [name, value] of Object.entries(fields)) {
        if (value === undefined || value === null) continue;
        const values = Array.isArray(value) ? value : [value];
        for (const item of values) {
          form.append(
            name,
            typeof item === 'object' ? JSON.stringify(item) : String(item),
          );
        }
      }
      try {
        const response = await http.post<ArrayBuffer>(`/api/v1/${path}`, form, {
          responseType: 'arraybuffer',
          timeout: 10 * 60_000,
        });
        const contentType = String(
          response.headers['content-type'] ?? 'application/octet-stream',
        );
        const data = Buffer.from(response.data);
        if (/json|text\//i.test(contentType)) {
          return { kind: 'text', text: data.toString('utf8').slice(0, 20_000) };
        }
        return {
          kind: 'file',
          file: {
            name: fileName(
              response.headers['content-disposition'] as string | undefined,
              'resultado.pdf',
            ),
            data,
            contentType: contentType.split(';')[0],
          },
        };
      } catch (error) {
        throw failure(error, `/api/v1/${path}`);
      }
    },
    /** As definições do servidor (só administrador); os segredos vêm escondidos pelo Stirling. */
    settings: (section?: string) =>
      call('/api/v1/admin/settings', () =>
        http.get<Record<string, unknown>>(
          section
            ? `/api/v1/admin/settings/section/${encodeURIComponent(section)}`
            : '/api/v1/admin/settings',
        ),
      ),
    /** Muda definições com chaves em notação de pontos (valem depois de reiniciar). */
    updateSettings: (settings: Record<string, unknown>) =>
      call('/api/v1/admin/settings', () =>
        http.put<Record<string, unknown>>('/api/v1/admin/settings', {
          settings,
        }),
      ),
    /** As mudanças à espera de um reinício. */
    pendingSettings: () =>
      call('/api/v1/admin/settings/delta', () =>
        http.get<Record<string, unknown>>('/api/v1/admin/settings/delta'),
      ),
    /** Se o MCP está ligado neste servidor (mcp.enabled): a lista das ferramentas dele. */
    mcpTools: async (): Promise<
      { name: string; annotations?: { readOnlyHint?: boolean } }[] | null
    > => {
      try {
        const response = await http.post<
          string | { result?: { tools?: { name: string }[] } }
        >(
          '/mcp',
          { jsonrpc: '2.0', id: 1, method: 'tools/list' },
          {
            timeout: 15_000,
            headers: { Accept: 'application/json, text/event-stream' },
            responseType: 'text',
            validateStatus: (status) => status === 200,
          },
        );
        const text =
          typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data);
        const json = text.trim().startsWith('{')
          ? text
          : (text
              .split('\n')
              .find((line) => line.startsWith('data:'))
              ?.slice(5) ?? '');
        const parsed = JSON.parse(json) as {
          result?: {
            tools?: {
              name: string;
              annotations?: { readOnlyHint?: boolean };
            }[];
          };
        };
        return parsed.result?.tools ?? null;
      } catch {
        return null;
      }
    },
    mcpUrl: () => `${root}/mcp`,
  };
}

export type StirlingClient = ReturnType<typeof createStirlingClient>;

/** A versão instalada, para as atualizações ("v3.3.0"). */
export async function stirlingVersion(baseUrl: string, apiKey: string) {
  const { version } = await createStirlingClient(baseUrl, apiKey).status();
  if (!version) throw new Error('O Stirling-PDF não disse a versão.');
  return `v${version.replace(/^v/, '')}`;
}
