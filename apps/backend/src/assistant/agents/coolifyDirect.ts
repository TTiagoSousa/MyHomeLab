import { AppAccessLevel } from 'src/generated/prisma/client/client';
import { createCoolifyClient } from 'src/coolify/coolify.client';
import { coolifyTarget } from '../toolsets/coolify-tools';
import { AgentContext } from './agent-context';
import { DirectMcp } from './trekDirect';

export const COOLIFY_SERVER = 'coolify';

/** Leem, mas devolvem segredos: ficam de fora quando só pode ler. */
const SECRET_READS = new Set(['get_env_values']);

/**
 * O MCP do próprio Coolify (POST <endereço>/mcp, Streamable HTTP) ligado diretamente ao
 * agente que tem as ferramentas dele (só no Claude Code): chegam como mcp__coolify__<nome>,
 * com o mesmo token (o que o MCP pode é o que o token pode). Tem de estar ligado na instância e
 * na equipa do token. O que pode é o que o acesso dele à app deixa: sem acesso, nada; só ler
 * (ou num disparo, sem ele a acompanhar), só as que o Coolify marca como só de leitura, sem as
 * que mostram valores de variáveis. Null quando não dá (sem Coolify, MCP desligado, em baixo):
 * ficam as coolify_* do MyHomeLab.
 */
export async function coolifyDirect(
  agentTools: string[],
  context: AgentContext,
  agentKey: string,
): Promise<DirectMcp | null> {
  if (!agentTools.some((tool) => tool.startsWith('coolify_'))) return null;
  const account = await coolifyTarget(context);
  if (typeof account === 'string') return null;
  const target = (await context.appAccess()).find(
    (entry) => entry.type === 'APP' && entry.id === account.id,
  );
  const level = target?.levels[agentKey] ?? AppAccessLevel.WRITE;
  if (level === AppAccessLevel.NONE) return null;
  const client = createCoolifyClient(
    account.baseUrl ?? '',
    account.accessToken ?? '',
  );
  const tools = await client.mcpTools();
  if (!tools?.length) return null;
  const readOnly = level === AppAccessLevel.READ || context.source !== 'chat';
  return {
    servers: {
      [COOLIFY_SERVER]: {
        type: 'http',
        url: client.mcpUrl(),
        headers: { Authorization: `Bearer ${account.accessToken ?? ''}` },
      },
    },
    allowedTools: readOnly
      ? tools
          .filter(
            (tool) =>
              tool.annotations?.readOnlyHint === true &&
              !SECRET_READS.has(tool.name),
          )
          .map((tool) => `mcp__${COOLIFY_SERVER}__${tool.name}`)
      : [`mcp__${COOLIFY_SERVER}__*`],
  };
}
