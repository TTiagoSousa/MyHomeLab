import { AppAccessLevel } from 'src/generated/prisma/client/client';
import { createStirlingClient } from 'src/stirling/stirling.client';
import { stirlingTarget } from '../tools/stirlingTools';
import { AgentContext } from './agent-context';
import { DirectMcp } from './trekDirect';

export const STIRLING_SERVER = 'stirling';

/**
 * O MCP do próprio Stirling-PDF ligado diretamente ao agente que tem as ferramentas do
 * Stirling (só no Claude Code e só quando o servidor tem o MCP ligado — mcp.enabled):
 * chegam como mcp__stirling__<nome>, com a mesma chave de API. Junta-se às stirling_* do
 * MyHomeLab (essas é que trazem os ficheiros do Paperless e do Nextcloud). O que pode é o
 * que o acesso dele à app deixa: sem acesso, nada; só ler (ou num disparo, sem ele a
 * acompanhar), só as que leem. Null quando não dá.
 */
export async function stirlingDirect(
  agentTools: string[],
  context: AgentContext,
  agentKey: string,
): Promise<DirectMcp | null> {
  if (!agentTools.some((tool) => tool.startsWith('stirling_'))) return null;
  const account = await stirlingTarget(
    context.connectedAccountRepository,
    context.userId,
  );
  if (typeof account === 'string') return null;
  const target = (await context.appAccess()).find(
    (entry) => entry.type === 'APP' && entry.id === account.id,
  );
  const level = target?.levels[agentKey] ?? AppAccessLevel.WRITE;
  if (level === AppAccessLevel.NONE) return null;
  const client = createStirlingClient(
    account.baseUrl ?? '',
    account.accessToken ?? '',
  );
  const tools = await client.mcpTools();
  if (!tools?.length) return null;
  const readOnly = level === AppAccessLevel.READ || context.source !== 'chat';
  return {
    servers: {
      [STIRLING_SERVER]: {
        type: 'http',
        url: client.mcpUrl(),
        headers: { 'X-API-KEY': account.accessToken ?? '' },
      },
    },
    allowedTools: readOnly
      ? tools
          .filter((tool) => tool.annotations?.readOnlyHint === true)
          .map((tool) => `mcp__${STIRLING_SERVER}__${tool.name}`)
      : [`mcp__${STIRLING_SERVER}__*`],
  };
}
