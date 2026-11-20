import { AppAccessLevel } from 'src/generated/prisma/client/client';
import { createGiteaMirrorClient } from 'src/gitea-mirror/gitea-mirror.client';
import { giteaMirrorTarget } from '../toolsets/gitea-mirror-tools';
import { AgentContext } from './agent-context';
import { DirectMcp } from './trekDirect';

export const GITEA_MIRROR_SERVER = 'gitea_mirror';

/**
 * O MCP do próprio Gitea Mirror (POST /api/mcp, v3.46+) ligado diretamente ao agente que tem
 * as ferramentas dele (só no Claude Code): chegam como mcp__gitea_mirror__<nome>, com a mesma
 * chave. Nenhuma apaga nem muda definições. O que pode é o que o acesso dele à app deixa: sem
 * acesso, nada; só ler (ou num disparo, sem ele a acompanhar), só as que leem. Null quando não
 * dá (sem Gitea Mirror, versão antiga, em baixo): ficam as gitea_mirror_* do MyHomeLab.
 */
export async function giteaMirrorDirect(
  agentTools: string[],
  context: AgentContext,
  agentKey: string,
): Promise<DirectMcp | null> {
  if (!agentTools.some((tool) => tool.startsWith('gitea_mirror_'))) return null;
  const account = await giteaMirrorTarget(context);
  if (typeof account === 'string') return null;
  const target = (await context.appAccess()).find(
    (entry) => entry.type === 'APP' && entry.id === account.id,
  );
  const level = target?.levels[agentKey] ?? AppAccessLevel.WRITE;
  if (level === AppAccessLevel.NONE) return null;
  const client = createGiteaMirrorClient(
    account.baseUrl ?? '',
    account.accessToken ?? '',
  );
  const tools = await client.mcpTools();
  if (!tools?.length) return null;
  const readOnly = level === AppAccessLevel.READ || context.source !== 'chat';
  const READS = new Set([
    'list_repositories',
    'get_repository',
    'list_failures',
    'list_organizations',
  ]);
  return {
    servers: {
      [GITEA_MIRROR_SERVER]: {
        type: 'http',
        url: client.mcpUrl(),
        headers: { 'x-api-key': account.accessToken ?? '' },
      },
    },
    allowedTools: readOnly
      ? tools
          .filter(
            (tool) =>
              tool.annotations?.readOnlyHint === true || READS.has(tool.name),
          )
          .map((tool) => `mcp__${GITEA_MIRROR_SERVER}__${tool.name}`)
      : [`mcp__${GITEA_MIRROR_SERVER}__*`],
  };
}
