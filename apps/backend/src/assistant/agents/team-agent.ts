import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { Agent } from 'src/generated/prisma/client/client';
import { guardTools } from 'src/agent/helpers/assistantToolPermissions';
import {
  composeAgentPrompt,
  delegationToolName,
} from 'src/agent/helpers/composeSystemPrompt';
import { TOOL_CATALOG, toolAction } from 'src/agent/tool-catalog';
import {
  AGENT_MODEL,
  AgentTool,
  RunAgentResult,
  SUBAGENT_MODEL,
  runAgent,
} from '../claude-agent.client';
import { buildToolbox } from '../toolsets/toolbox';
import { AgentContext } from './agent-context';
import { TREK_PROXY_TOOLS, TREK_SERVER, trekDirect } from './trekDirect';

/** Mais fundo do que isto é uma equipa mal montada, não trabalho útil. */
const MAX_DEPTH = 5;

const SERVER_SETS = new Set(['server', 'serverControl', 'serverShell']);

/** Quem lê documentos ou mexe em servidores recebe o índice dos documentos. */
const usesDocs = (agent: Agent) =>
  TOOL_CATALOG.some(
    (entry) =>
      (entry.set === 'docs' || SERVER_SETS.has(entry.set)) &&
      agent.tools.includes(entry.name),
  );

/**
 * Os documentos obrigatórios ligados ao que o pedido menciona ("atualiza o
 * AdGuard" → as regras do AdGuard) vão no fim do último pedido, e não nas
 * instruções: mudam de pedido para pedido e as instruções têm de ficar iguais
 * para a cache valer.
 */
async function withRequiredDocs(
  messages: MessageParam[],
  context: AgentContext,
): Promise<MessageParam[]> {
  const index = messages.map((message) => message.role).lastIndexOf('user');
  const last = messages[index];
  if (index < 0 || typeof last.content !== 'string') return messages;
  const docs = await context.docs.requiredFor(
    context.userId,
    last.content,
    context.agentKey,
  );
  if (!docs.length) return messages;
  for (const doc of docs) context.docsUsed?.set(doc.id, doc.title);
  const block =
    'DOCUMENTOS OBRIGATÓRIOS PARA ESTE PEDIDO (regras do utilizador sobre o que o pedido toca — segue-as):\n' +
    docs
      .map((doc) => `── ${doc.title} (${doc.id}) ──\n${doc.content.trim()}`)
      .join('\n\n');
  const copy = [...messages];
  copy[index] = { ...last, content: `${last.content}\n\n${block}` };
  return copy;
}

/** O pormenor de uma ação para o histórico: o ficheiro, a pesquisa, o destinatário… */
function actionDetail(input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const fields = input as Record<string, unknown>;
  return ['filename', 'query', 'to', 'subject', 'name', 'title', 'mode']
    .map((key) => fields[key])
    .filter(
      (value): value is string => typeof value === 'string' && value !== '',
    )
    .map((value) => value.slice(0, 80))
    .join(' · ');
}

/**
 * Corre qualquer agente da equipa a partir da configuração dele: as instruções, o
 * modelo, as ferramentas do catálogo e uma ferramenta por cada agente que lhe
 * responde. É o mesmo executor para o CEO e para um agente criado na hora.
 */
export async function runTeamAgent(
  agent: Agent,
  messages: MessageParam[],
  context: AgentContext,
  depth = 0,
): Promise<RunAgentResult> {
  const members =
    depth < MAX_DEPTH
      ? context.team.filter(
          (member) => member.reportsToId === agent.id && member.isActive,
        )
      : [];
  const trek = await trekDirect(agent.tools, context, agent.key);
  const toolNames = trek
    ? agent.tools.filter((tool) => !TREK_PROXY_TOOLS.has(tool))
    : agent.tools;
  const tools = [
    ...(await buildToolbox(toolNames, { ...context, agentKey: agent.key })),
    ...members.map((member) => delegationTool(agent, member, context, depth)),
  ];
  const docs = usesDocs(agent)
    ? await context.docs.agentContext(context.userId, agent.key)
    : null;

  return runAgent(
    context.ai,
    composeAgentPrompt(agent, context.team, docs) +
      (trek
        ? `

O TREK: as ferramentas do próprio TREK estão ligadas diretamente (mcp__${TREK_SERVER}__<nome>, ex.: mcp__${TREK_SERVER}__list_trips). Usa-as em vez de trek_tools/trek_read/trek_write.`
        : ''),
    guardTools(tools, context.deniedPermissions, {
      agentKey: agent.key,
      targets: context.appAccess,
    }),
    docs
      ? await withRequiredDocs(messages, { ...context, agentKey: agent.key })
      : messages,
    {
      onToolUse: (toolName, input) => {
        const action =
          toolAction(toolName) ??
          (toolName.startsWith(`mcp__${TREK_SERVER}__`)
            ? `no TREK: ${toolName.slice(`mcp__${TREK_SERVER}__`.length)}`
            : null) ??
          delegationAction(toolName, members) ??
          `a usar ${toolName}`;
        const detail = actionDetail(input);
        context.actionsDone?.push(
          `${agent.name}: ${action}${detail ? ` (${detail})` : ''}`,
        );
        context.activity.update(context.userId, agent.key, action);
      },
      mcpServers: trek?.servers,
      allowedTools: trek?.allowedTools,
      onUsage: (usage) => {
        context.onUsage?.(usage);
        context.recordUsage?.(agent.key, usage);
      },
      model: agent.model === 'OPUS' ? AGENT_MODEL : SUBAGENT_MODEL,
      effort:
        agent.effort === 'HIGH'
          ? 'high'
          : agent.effort === 'MEDIUM'
            ? 'medium'
            : 'low',
    },
  );
}

/**
 * A ferramenta com que um chefe passa trabalho a alguém da equipa. A atividade acende
 * aqui, à volta da delegação, e não dentro do agente: assim cobre também a primeira
 * chamada ao modelo, antes de haver qualquer ferramenta a reportar.
 */
function delegationTool(
  boss: Agent,
  member: Agent,
  context: AgentContext,
  depth: number,
): AgentTool {
  return {
    name: delegationToolName(member.key),
    description:
      `Pede um trabalho a ${member.name}: ${member.description} ` +
      'Devolve o relatório dele.',
    inputSchema: {
      type: 'object',
      properties: {
        request: {
          type: 'string',
          description:
            'O que precisas, completo: o pedido do utilizador nas palavras dele, com as datas, horas, nomes e quantidades.',
        },
      },
      required: ['request'],
    },
    handler: (input: { request: string }) =>
      context.activity.track(
        context.userId,
        member.key,
        `a tratar de um pedido de ${boss.name}`,
        async () => {
          const { replyText } = await runTeamAgent(
            member,
            [{ role: 'user', content: `(${today()})\n${input.request}` }],
            context,
            depth + 1,
          );
          return (
            replyText || `${member.name} não conseguiu escrever o relatório.`
          );
        },
        { from: boss.key, text: input.request },
      ),
  };
}

function delegationAction(toolName: string, members: Agent[]): string | null {
  const member = members.find(
    (entry) => delegationToolName(entry.key) === toolName,
  );
  return member ? `a pedir trabalho a ${member.name}` : null;
}

/** A data vai no pedido e não nas instruções, para não estragar a cache. */
function today(): string {
  const date = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Europe/Lisbon',
  });
  const weekday = new Date().toLocaleDateString('pt-PT', {
    timeZone: 'Europe/Lisbon',
    weekday: 'long',
  });
  const time = new Date().toLocaleTimeString('pt-PT', {
    timeZone: 'Europe/Lisbon',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `Hoje é ${weekday}, ${date}; são ${time} (hora de Lisboa).`;
}
