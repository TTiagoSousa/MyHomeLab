import { randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import type { AgentTool } from 'src/assistant/claude-agent.client';
import { clip } from 'src/assistant/apiAgent';

/** O nome do servidor MCP do MyHomeLab: as ferramentas chegam como mcp__myhomelab__<nome>. */
export const BRIDGE_SERVER = 'myhomelab';
export const BRIDGE_PREFIX = `mcp__${BRIDGE_SERVER}__`;

interface Bridge {
  token: string;
  tools: AgentTool[];
}

const bridges = new Map<string, Bridge>();

/** Onde o backend ouve, visto de dentro da própria máquina. */
const bridgeBase = () => `http://127.0.0.1:${process.env.PORT ?? 3000}`;

/**
 * Abre a ponte de uma corrida: um endereço com um token aleatório só dela, que
 * serve as ferramentas deste agente (já com as permissões aplicadas) e mais
 * nenhuma. Fecha-se no fim da corrida.
 */
export function openBridge(tools: AgentTool[], ttlMs?: number) {
  const id = randomUUID();
  const token = randomBytes(32).toString('hex');
  bridges.set(id, { token, tools });
  // Uma ponte de longa duração (o terminal) fecha-se sozinha no fim do prazo.
  if (ttlMs) setTimeout(() => bridges.delete(id), ttlMs).unref();
  return {
    server: {
      type: 'http',
      url: `${bridgeBase()}/internal/mcp/${id}`,
      headers: { Authorization: `Bearer ${token}` },
    },
    close: () => bridges.delete(id),
  };
}

const sameToken = (given: string, expected: string) => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

interface RpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: {
    protocolVersion?: string;
    name?: string;
    arguments?: Record<string, unknown>;
  };
}

const reply = (id: RpcRequest['id'], result: unknown) => ({
  jsonrpc: '2.0',
  id,
  result,
});

const failure = (id: RpcRequest['id'], code: number, message: string) => ({
  jsonrpc: '2.0',
  id,
  error: { code, message },
});

async function answer(bridge: Bridge, request: RpcRequest) {
  const { id, method, params } = request;
  if (method === 'initialize') {
    return reply(id, {
      protocolVersion: params?.protocolVersion ?? '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: BRIDGE_SERVER, version: '1.0.0' },
    });
  }
  if (method === 'ping') return reply(id, {});
  if (method === 'tools/list') {
    return reply(id, {
      tools: bridge.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    });
  }
  if (method === 'tools/call') {
    const tool = bridge.tools.find((entry) => entry.name === params?.name);
    if (!tool) {
      return reply(id, {
        content: [
          { type: 'text', text: `Ferramenta desconhecida: ${params?.name}` },
        ],
        isError: true,
      });
    }
    // Uma ferramenta que rebenta é um facto (serviço em baixo, credenciais más):
    // volta ao modelo como resultado, para ele explicar o que se passou.
    try {
      const text = clip(await tool.handler(params?.arguments ?? {}));
      return reply(id, { content: [{ type: 'text', text }] });
    } catch (error) {
      return reply(id, {
        content: [
          {
            type: 'text',
            text: `A ferramenta ${tool.name} falhou: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      });
    }
  }
  return failure(id, -32601, `Método desconhecido: ${method}`);
}

/**
 * Um pedido MCP (Streamable HTTP, respostas em JSON) para a ponte `id`. Devolve
 * o estado HTTP e o corpo; null no corpo = só notificações (202).
 */
export async function handleBridge(
  id: string,
  authorization: string | undefined,
  body: unknown,
): Promise<{ status: number; body: unknown }> {
  const bridge = bridges.get(id);
  const token = authorization?.replace(/^Bearer\s+/i, '') ?? '';
  if (!bridge || !sameToken(token, bridge.token)) {
    return { status: 401, body: { error: 'Ponte desconhecida ou fechada.' } };
  }
  const requests = (Array.isArray(body) ? body : [body]) as RpcRequest[];
  const answers = await Promise.all(
    requests
      .filter(
        (request) => request && request.id !== undefined && request.id !== null,
      )
      .map((request) => answer(bridge, request)),
  );
  if (!answers.length) return { status: 202, body: null };
  return { status: 200, body: Array.isArray(body) ? answers : answers[0] };
}
