import { AppAccessLevel } from 'src/generated/prisma/client/client';
import {
  isReadOnlyOpenGymTool,
  openGymMcpOf,
  openGymMcpTools,
  openGymMcpUrl,
} from 'src/opengym/openGymMcp.client';
import { openGymTarget } from '../tools/openGymTools';
import { AgentContext } from './agent-context';
import { DirectMcp } from './trekDirect';

export const OPENGYM_SERVER = 'opengym';

/**
 * O MCP do próprio openGym ligado diretamente ao agente que tem as ferramentas do
 * openGym (só no Claude Code): chegam como mcp__opengym__<nome>, com o token de API
 * (ogt_) da conta. Substitui por inteiro as opengym_* do MyHomeLab. O que pode é o
 * que o acesso dele à app deixa: sem acesso, nada; só ler (ou num disparo, sem ele a
 * acompanhar), só as que leem. Null quando não dá (sem openGym, mais do que um, sem
 * token de API, MCP em baixo): ficam as opengym_* do MyHomeLab.
 */
export async function openGymDirect(
  agentTools: string[],
  context: AgentContext,
  agentKey: string,
): Promise<DirectMcp | null> {
  if (!agentTools.some((tool) => tool.startsWith('opengym_'))) return null;
  const account = await openGymTarget(
    context.connectedAccountRepository,
    context.userId,
  );
  if (typeof account === 'string') return null;
  const mcp = openGymMcpOf(account);
  if (!mcp) return null;
  const target = (await context.appAccess()).find(
    (entry) => entry.type === 'APP' && entry.id === account.id,
  );
  const level = target?.levels[agentKey] ?? AppAccessLevel.WRITE;
  if (level === AppAccessLevel.NONE) return null;
  try {
    const tools = await openGymMcpTools(mcp);
    const readOnly = level === AppAccessLevel.READ || context.source !== 'chat';
    return {
      servers: {
        [OPENGYM_SERVER]: {
          type: 'http',
          url: openGymMcpUrl(mcp),
          headers: { Authorization: `Bearer ${mcp.token}` },
        },
      },
      allowedTools: readOnly
        ? tools
            .filter(isReadOnlyOpenGymTool)
            .map((tool) => `mcp__${OPENGYM_SERVER}__${tool.name}`)
        : [`mcp__${OPENGYM_SERVER}__*`],
    };
  } catch {
    return null;
  }
}
