import axios from 'axios';
import { Agent } from 'https';
import { AppIntegrationError } from 'src/integrations/app-integration.error';

/** Uma ferramenta do servidor MCP do TREK, como o tools/list a devolve. */
export interface TrekMcpTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
  };
}

interface TrekMcpCredentials {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
}

const httpsAgent = new Agent({ rejectUnauthorized: false });
const PROTOCOL_VERSION = '2025-03-26';

/** Os tokens (1 hora) e as sessões MCP, por cliente: pedem-se outra vez quando acabam. */
const tokens = new Map<string, { token: string; until: number }>();
const sessions = new Map<string, string>();
const toolCache = new Map<string, { at: number; tools: TrekMcpTool[] }>();
const TOOLS_CACHE_MS = 10 * 60_000;

const root = (baseUrl: string) => baseUrl.trim().replace(/\/+$/, '');
const keyOf = (credentials: TrekMcpCredentials) =>
  `${root(credentials.baseUrl)}|${credentials.clientId}`;

const explain = (error: unknown, what: string) => {
  if (error instanceof AppIntegrationError) return error;
  if (axios.isAxiosError(error) && error.response) {
    const status = error.response.status;
    const body = error.response.data as
      { error?: string; error_description?: string } | undefined;
    if (status === 403 || status === 404) {
      return new AppIntegrationError(
        'APP_NOT_SUPPORTED',
        'O TREK não tem o MCP ligado: um administrador liga-o em Admin → Addons → MCP.',
      );
    }
    if (status === 401 || status === 400) {
      return new AppIntegrationError(
        'APP_AUTH_FAILED',
        `O TREK recusou o cliente MCP (${body?.error_description ?? body?.error ?? status}). Confirma o client_id e o client_secret do cliente máquina.`,
      );
    }
    return new AppIntegrationError(
      'APP_UNREACHABLE',
      `O TREK respondeu ${status} em ${what}.`,
    );
  }
  return new AppIntegrationError(
    'APP_UNREACHABLE',
    `Não foi possível falar com o TREK: ${error instanceof Error ? error.message : String(error)}`,
  );
};

/** O token do cliente máquina (client_credentials), guardado até faltar um minuto. */
async function accessToken(credentials: TrekMcpCredentials, fresh = false) {
  const key = keyOf(credentials);
  const cached = tokens.get(key);
  if (!fresh && cached && cached.until > Date.now()) return cached.token;
  try {
    const { data } = await axios.post<{
      access_token?: string;
      expires_in?: number;
    }>(
      `${root(credentials.baseUrl)}/oauth/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      }).toString(),
      {
        httpsAgent,
        timeout: 15_000,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );
    if (!data?.access_token) {
      throw new AppIntegrationError(
        'APP_AUTH_FAILED',
        'O TREK não devolveu o token do cliente MCP.',
      );
    }
    tokens.set(key, {
      token: data.access_token,
      until: Date.now() + Math.max((data.expires_in ?? 3600) - 60, 60) * 1000,
    });
    sessions.delete(key);
    return data.access_token;
  } catch (error) {
    throw explain(error, '/oauth/token');
  }
}

/** A resposta JSON-RPC de um pedido: em JSON ou numa stream SSE ("data: {…}"). */
export function rpcResult(body: unknown, id: number, app = 'TREK'): unknown {
  const messages: unknown[] = [];
  if (typeof body === 'string') {
    for (const line of body.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue;
      try {
        messages.push(JSON.parse(line.slice(5).trim()));
      } catch {
        // uma linha que não é JSON (um ping) não conta
      }
    }
    if (!messages.length && body.trim().startsWith('{')) {
      messages.push(JSON.parse(body));
    }
  } else if (body) messages.push(body);
  const reply = messages
    .flat()
    .find((message) => (message as { id?: unknown } | null)?.id === id) as
    { result?: unknown; error?: { message?: string } } | undefined;
  if (!reply) throw new Error(`o ${app} não respondeu ao pedido MCP`);
  if (reply.error) {
    throw new AppIntegrationError(
      'APP_UNREACHABLE',
      `O MCP do ${app} recusou: ${reply.error.message ?? 'erro'}`,
    );
  }
  return reply.result;
}

let nextId = 1;

async function post(
  credentials: TrekMcpCredentials,
  token: string,
  session: string | undefined,
  payload: Record<string, unknown>,
) {
  return axios.post<string>(`${root(credentials.baseUrl)}/mcp`, payload, {
    httpsAgent,
    timeout: 60_000,
    responseType: 'text',
    transformResponse: (data: unknown) => data,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': PROTOCOL_VERSION,
      ...(session ? { 'Mcp-Session-Id': session } : {}),
    },
  });
}

/** Abre a sessão MCP (initialize + initialized) e guarda o id. */
async function openSession(credentials: TrekMcpCredentials, token: string) {
  const id = nextId++;
  const response = await post(credentials, token, undefined, {
    jsonrpc: '2.0',
    id,
    method: 'initialize',
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'MyHomeLab', version: '1' },
    },
  });
  rpcResult(response.data, id);
  const session = response.headers['mcp-session-id'] as string | undefined;
  await post(credentials, token, session, {
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  });
  if (session) sessions.set(keyOf(credentials), session);
  return session;
}

/** Um pedido MCP; uma sessão ou um token que acabaram abrem-se outra vez, uma vez. */
async function request(
  credentials: TrekMcpCredentials,
  method: string,
  params: Record<string, unknown>,
) {
  const key = keyOf(credentials);
  for (let attempt = 0; ; attempt++) {
    try {
      const token = await accessToken(credentials, attempt > 0);
      const session =
        sessions.get(key) ?? (await openSession(credentials, token));
      const id = nextId++;
      const response = await post(credentials, token, session, {
        jsonrpc: '2.0',
        id,
        method,
        params,
      });
      return rpcResult(response.data, id);
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : null;
      sessions.delete(key);
      if (attempt === 0 && (status === 401 || status === 404)) continue;
      throw explain(error, '/mcp');
    }
  }
}

/** Todas as ferramentas do TREK (com a paginação do tools/list), 10 minutos em cache. */
export async function trekMcpTools(
  credentials: TrekMcpCredentials,
  fresh = false,
): Promise<TrekMcpTool[]> {
  const key = keyOf(credentials);
  const cached = toolCache.get(key);
  if (!fresh && cached && Date.now() - cached.at < TOOLS_CACHE_MS) {
    return cached.tools;
  }
  const tools: TrekMcpTool[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page++) {
    const result = (await request(
      credentials,
      'tools/list',
      cursor ? { cursor } : {},
    )) as { tools?: TrekMcpTool[]; nextCursor?: string };
    tools.push(...(result.tools ?? []));
    cursor = result.nextCursor;
    if (!cursor) break;
  }
  toolCache.set(key, { at: Date.now(), tools });
  return tools;
}

/** Chama uma ferramenta do TREK e devolve o texto da resposta (e se foi um erro). */
export async function trekMcpCall(
  credentials: TrekMcpCredentials,
  name: string,
  args: Record<string, unknown>,
): Promise<{ text: string; isError: boolean }> {
  const result = (await request(credentials, 'tools/call', {
    name,
    arguments: args,
  })) as {
    content?: { type: string; text?: string }[];
    structuredContent?: unknown;
    isError?: boolean;
  };
  const text =
    (result.content ?? [])
      .map((part) =>
        part.type === 'text' ? (part.text ?? '') : `[${part.type}]`,
      )
      .join('\n')
      .trim() ||
    (result.structuredContent ? JSON.stringify(result.structuredContent) : '');
  return { text, isError: Boolean(result.isError) };
}

/** As credenciais MCP de uma conta TREK (já desencriptada), ou null sem cliente. */
export const trekMcpOf = (account: {
  baseUrl: string | null;
  apiClientId: string | null;
  apiClientSecret: string | null;
}): TrekMcpCredentials | null =>
  account.baseUrl && account.apiClientId && account.apiClientSecret
    ? {
        baseUrl: account.baseUrl,
        clientId: account.apiClientId,
        clientSecret: account.apiClientSecret,
      }
    : null;

/** O token do cliente máquina, para ligar o MCP do TREK diretamente a um agente. */
export const trekAccessToken = (credentials: TrekMcpCredentials) =>
  accessToken(credentials);

/** O endereço do MCP do TREK. */
export const trekMcpUrl = (credentials: TrekMcpCredentials) =>
  `${root(credentials.baseUrl)}/mcp`;

/** Esquece o token e a sessão (ao trocar ou tirar o cliente). */
export function forgetTrekMcp(credentials: TrekMcpCredentials) {
  const key = keyOf(credentials);
  tokens.delete(key);
  sessions.delete(key);
  toolCache.delete(key);
}

/** Se uma ferramenta só lê (a anotação do TREK, ou o nome quando não a tem). */
export const isReadOnlyTool = (tool: TrekMcpTool) =>
  tool.annotations?.readOnlyHint ??
  /^(list|get|search|read|find|lookup|show|count|check|describe)_/.test(
    tool.name,
  );
