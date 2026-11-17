import axios from 'axios';
import { Agent } from 'https';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { rpcResult } from 'src/trek/trekMcp.client';
import { normalizeOpenGymUrl } from './opengym.client';

// O MCP do openGym (/mcp, HTTP sem sessão), com um token de API "ogt_…" criado no
// openGym em Definições → Integrações → Tokens de API. O token do emparelhamento não
// serve: o /mcp só aceita os tokens de API.

/** Uma ferramenta do MCP do openGym, como o tools/list a devolve. */
export interface OpenGymMcpTool {
  name: string;
  title?: string;
  description?: string;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
}

export interface OpenGymMcp {
  baseUrl: string;
  token: string;
}

const httpsAgent = new Agent({ rejectUnauthorized: false });
const PROTOCOL_VERSION = '2025-03-26';
const TOOLS_CACHE_MS = 10 * 60_000;
const toolCache = new Map<string, { at: number; tools: OpenGymMcpTool[] }>();

/** As que só leem, para quando o openGym não manda a anotação readOnlyHint. */
const READ_ONLY = new Set([
  'list_routines',
  'get_routine',
  'preview_session',
  'get_week_plan',
  'list_workouts',
  'get_workout',
  'get_bodyweight',
  'estimate_1rm',
  'muscle_balance',
  'get_programme',
  'search_exercises',
]);

const keyOf = (mcp: OpenGymMcp) =>
  `${normalizeOpenGymUrl(mcp.baseUrl)}|${mcp.token.slice(-8)}`;

const explain = (error: unknown) => {
  if (error instanceof AppIntegrationError) return error;
  if (axios.isAxiosError(error) && error.response) {
    const status = error.response.status;
    if (status === 401 || status === 403) {
      return new AppIntegrationError(
        'APP_AUTH_FAILED',
        'O openGym recusou o token do MCP. Usa um token de API (ogt_…) de Definições → Integrações → Tokens de API; o do emparelhamento não serve.',
      );
    }
    if (status === 503 || status === 404) {
      return new AppIntegrationError(
        'APP_NOT_SUPPORTED',
        'O openGym não tem o MCP ligado: no servidor dele, MCP=on e COMPOSE_PROFILES=mcp no .env, e docker compose up -d.',
      );
    }
    return new AppIntegrationError(
      'APP_UNREACHABLE',
      `O openGym respondeu ${status} no /mcp.`,
    );
  }
  return new AppIntegrationError(
    'APP_UNREACHABLE',
    `Não foi possível falar com o MCP do openGym: ${error instanceof Error ? error.message : String(error)}`,
  );
};

let nextId = 1;

async function rpc(
  mcp: OpenGymMcp,
  method: string,
  params: Record<string, unknown>,
) {
  const id = nextId++;
  const response = await axios.post<string>(
    openGymMcpUrl(mcp),
    { jsonrpc: '2.0', id, method, params },
    {
      httpsAgent,
      timeout: 30_000,
      responseType: 'text',
      transformResponse: (data: unknown) => data,
      headers: {
        Authorization: `Bearer ${mcp.token}`,
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': PROTOCOL_VERSION,
      },
    },
  );
  return rpcResult(response.data, id, 'openGym');
}

/** As ferramentas do MCP do openGym, 10 minutos em cache. */
export async function openGymMcpTools(
  mcp: OpenGymMcp,
  fresh = false,
): Promise<OpenGymMcpTool[]> {
  const key = keyOf(mcp);
  const cached = toolCache.get(key);
  if (!fresh && cached && Date.now() - cached.at < TOOLS_CACHE_MS) {
    return cached.tools;
  }
  try {
    await rpc(mcp, 'initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'MyHomeLab', version: '1' },
    });
    const result = (await rpc(mcp, 'tools/list', {})) as {
      tools?: OpenGymMcpTool[];
    };
    const tools = result.tools ?? [];
    toolCache.set(key, { at: Date.now(), tools });
    return tools;
  } catch (error) {
    throw explain(error);
  }
}

/** O MCP de uma conta openGym (já desencriptada), ou null sem token de API. */
export const openGymMcpOf = (account: {
  baseUrl: string | null;
  apiClientSecret: string | null;
}): OpenGymMcp | null =>
  account.baseUrl && account.apiClientSecret
    ? { baseUrl: account.baseUrl, token: account.apiClientSecret }
    : null;

export const openGymMcpUrl = (mcp: OpenGymMcp) =>
  `${normalizeOpenGymUrl(mcp.baseUrl)}/mcp`;

export const forgetOpenGymMcp = (mcp: OpenGymMcp) =>
  toolCache.delete(keyOf(mcp));

/** Se uma ferramenta só lê (a anotação do openGym, ou a lista conhecida). */
export const isReadOnlyOpenGymTool = (tool: OpenGymMcpTool) =>
  tool.annotations?.readOnlyHint ?? READ_ONLY.has(tool.name);
