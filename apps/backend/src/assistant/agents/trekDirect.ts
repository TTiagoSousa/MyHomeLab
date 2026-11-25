import { userWroteThisTurn } from 'src/agent/helpers/userIsSpeaking';
import { AppAccessLevel } from 'src/generated/prisma/client/client';
import {
  isReadOnlyTool,
  trekAccessToken,
  trekMcpOf,
  trekMcpTools,
  trekMcpUrl,
} from 'src/trek/trekMcp.client';
import { trekTarget } from '../tools/trekTools';
import { AgentContext } from './agent-context';

export const TREK_SERVER = 'trek';

/** As ferramentas do MyHomeLab que o MCP direto substitui (fica só o trek_overview). */
export const TREK_PROXY_TOOLS = new Set([
  'trek_tools',
  'trek_tool_help',
  'trek_read',
  'trek_write',
]);

export interface DirectMcp {
  servers: Record<string, unknown>;
  allowedTools: string[];
}

/**
 * O MCP do próprio TREK ligado diretamente ao agente que tem as ferramentas do
 * TREK: as ferramentas dele chegam como mcp__trek__<nome>, com o token do
 * cliente máquina (1 hora, pedido agora). O que pode é o que o acesso dele à app
 * deixa: sem acesso, nada; só ler (ou num disparo, sem ele a acompanhar), só as
 * ferramentas que leem. Null quando não dá (sem TREK, sem cliente MCP, em
 * baixo): ficam as ferramentas trek_* do MyHomeLab, que explicam o porquê.
 */
export async function trekDirect(
  agentTools: string[],
  context: AgentContext,
  agentKey: string,
): Promise<DirectMcp | null> {
  if (!agentTools.some((tool) => tool.startsWith('trek_'))) return null;
  const account = await trekTarget(
    context.connectedAccountRepository,
    context.userId,
  );
  if (typeof account === 'string') return null;
  const credentials = trekMcpOf(account);
  if (!credentials) return null;
  const target = (await context.appAccess()).find(
    (entry) => entry.type === 'APP' && entry.id === account.id,
  );
  const level = target?.levels[agentKey] ?? AppAccessLevel.WRITE;
  if (level === AppAccessLevel.NONE) return null;
  try {
    const [token, tools] = await Promise.all([
      trekAccessToken(credentials),
      trekMcpTools(credentials),
    ]);
    const readOnly =
      level === AppAccessLevel.READ || !userWroteThisTurn(context.source);
    return {
      servers: {
        [TREK_SERVER]: {
          type: 'http',
          url: trekMcpUrl(credentials),
          headers: { Authorization: `Bearer ${token}` },
        },
      },
      allowedTools: readOnly
        ? tools
            .filter(isReadOnlyTool)
            .map((tool) => `mcp__${TREK_SERVER}__${tool.name}`)
        : [`mcp__${TREK_SERVER}__*`],
    };
  } catch {
    return null;
  }
}
