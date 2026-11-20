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
import { OPENGYM_SERVER, openGymDirect } from './openGymDirect';
import { STIRLING_SERVER, stirlingDirect } from './stirlingDirect';
import { GITEA_MIRROR_SERVER, giteaMirrorDirect } from './giteaMirrorDirect';
import { COOLIFY_SERVER, coolifyDirect } from './coolifyDirect';

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
 * As ferramentas que mudam coisas num servidor, numa app ou no email. Antes de uma
 * delas, o agente tem de ter lido (docs_read) os documentos do que o pedido toca.
 */
const ACTS =
  /^(server_run_command|pve_(guest_power|create_snapshot|rollback_snapshot|delete_snapshot|backup_now|set_resources)|disk_alert_grow|run_backup|update_(save_study|prepare|run|verify)|adguard_(set|manage|refresh)_\w+|ha_(call_service|save_config|delete_config|update_entity)|forgejo_(create|comment|set)_\w+|opengym_(create|delete|update|schedule)_\w+|gametracker_(set_game|remove_game|watch_price)|immich_(save_album|update_person|run_job|set_settings)|paperless_(update_document|bulk_edit|save_object|set_settings)|solidtime_(start_timer|stop_timer|save_entry|save_object)|stirling_(run|set_settings)|plane_(create|update|comment)|gitea_mirror_(add|run|import)|infisical_(secret_set|secret_delete|folder_create)|vaultwarden_(invite|user_action|delete_user|backup_db|test_smtp)|postgres_(execute|cancel)|clickhouse_(execute|kill)|nginx_proxy_manager_(create_host|update_host|toggle_host|delete_host|renew_certificate)|coolify_(deploy|control|set_env)|dispatcharr_(channel_edit|channel_create|channel_delete|refresh|stop|recordings|backups)|jellyfin_(scan|session_control|user_manage|task_run|restart|server_backup)|drive_(sheet_update|sheet_append|sheet_add_tab|sheet_format|create|create_folder|convert_to_sheet)|trek_write|(create|update|delete)_email_rule|implement_email_proposal|modify_email|trash_email|send_email_draft)$/;

/**
 * Os documentos que o pedido toca (DocsService.docsFor) vão no fim do último pedido
 * como uma lista para ler — e não inteiros: o agente lê-os com docs_read, um a um.
 * Os que o próprio pedido já traz inteiros (o bloco DOCUMENTOS de uma atualização,
 * com o id) contam como lidos. Fica no fim do pedido, e não nas instruções, para as
 * instruções ficarem iguais e a cache valer.
 */
async function withDocsToRead(
  messages: MessageParam[],
  context: AgentContext,
  toRead: Map<string, string>,
): Promise<MessageParam[]> {
  const index = messages.map((message) => message.role).lastIndexOf('user');
  const last = messages[index];
  if (index < 0) return messages;
  // Com ficheiros, o pedido são blocos: conta o que ele escreveu e os nomes dos ficheiros
  // (o conteúdo lido de um Word ou de uma folha fica de fora).
  const text =
    typeof last.content === 'string'
      ? last.content
      : last.content
          .map((block) =>
            block.type === 'text' && !block.text.startsWith('## Ficheiro ')
              ? block.text
              : '',
          )
          .join('\n');
  const docs = await context.docs.docsFor(
    context.userId,
    text,
    context.agentKey,
  );
  for (const doc of docs) {
    if (text.includes(`(${doc.id})`)) context.docsUsed?.set(doc.id, doc.title);
    else toRead.set(doc.id, doc.title);
  }
  if (!toRead.size) return messages;
  const block =
    'DOCUMENTOS PARA LER ANTES DE AGIR (o que o pedido toca, pelos títulos, etiquetas e ligações — lê cada um com docs_read antes de mudar o que quer que seja; as ferramentas que mudam coisas só respondem depois):\n' +
    [...toRead].map(([id, title]) => `- ${title} (${id})`).join('\n') +
    '\nSe no índice houver outro documento que toque no que vais fazer (pelo título ou pelas etiquetas), lê-o também.';
  const copy = [...messages];
  copy[index] = {
    ...last,
    content:
      typeof last.content === 'string'
        ? `${last.content}\n\n${block}`
        : [...last.content, { type: 'text', text: block }],
  };
  return copy;
}

/** Recusa uma ferramenta que muda coisas enquanto houver documentos por ler. */
function readFirst(
  tools: AgentTool[],
  toRead: Map<string, string>,
  read: Map<string, string>,
): AgentTool[] {
  return tools.map((tool) =>
    ACTS.test(tool.name)
      ? {
          ...tool,
          handler: async (input: unknown) => {
            const missing = [...toRead].filter(([id]) => !read.has(id));
            if (missing.length) {
              return (
                'Ainda não leste as regras do que vais mexer. Lê primeiro com docs_read: ' +
                missing.map(([id, title]) => `"${title}" (${id})`).join(', ') +
                '. Depois volta a chamar esta ferramenta.'
              );
            }
            return tool.handler(input);
          },
        }
      : tool,
  );
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
  // O TREK e o openGym de duas maneiras, pelo fornecedor da IA: no Claude Code, o MCP de
  // cada um ligado diretamente ao agente (mcp__trek__*, mcp__opengym__*); na API, as
  // ferramentas trek_* e opengym_* do MyHomeLab, que falam com eles a partir do backend
  // (a API não chega às apps da rede de casa).
  // No modo Misto os subagentes podem ir noutro fornecedor (context.ai.delegate). Entra
  // na fila do Claude Code o primeiro no Claude Code de cada cadeia: o de topo, ou um
  // subagente cujo chefe está na API.
  const ai = depth > 0 ? (context.ai.delegate ?? context.ai) : context.ai;
  const parent =
    depth === 0
      ? null
      : depth === 1
        ? context.ai
        : (context.ai.delegate ?? context.ai);
  const claudeCode = ai.provider === 'CLAUDE_CODE';
  const queued = claudeCode && parent?.provider !== 'CLAUDE_CODE';
  const [trek, openGym, stirling, giteaMirror, coolify] = claudeCode
    ? await Promise.all([
        trekDirect(agent.tools, context, agent.key),
        openGymDirect(agent.tools, context, agent.key),
        stirlingDirect(agent.tools, context, agent.key).catch(() => null),
        giteaMirrorDirect(agent.tools, context, agent.key).catch(() => null),
        coolifyDirect(agent.tools, context, agent.key).catch(() => null),
      ])
    : [null, null, null, null, null];
  const direct = [trek, openGym, stirling, giteaMirror, coolify].filter(
    (entry): entry is NonNullable<typeof entry> => Boolean(entry),
  );
  const toolNames = agent.tools.filter(
    (tool) =>
      !(trek && TREK_PROXY_TOOLS.has(tool)) &&
      !(openGym && tool.startsWith('opengym_')),
  );
  const read = context.docsUsed ?? new Map<string, string>();
  const toRead = new Map<string, string>();
  const tools = [
    ...(await buildToolbox(toolNames, {
      ...context,
      agentKey: agent.key,
      docsUsed: read,
    })),
    ...members.map((member) => delegationTool(agent, member, context, depth)),
  ];
  const docs = usesDocs(agent)
    ? await context.docs.agentContext(context.userId)
    : null;

  return runAgent(
    ai,
    composeAgentPrompt(agent, context.team, docs) +
      (trek
        ? `

O TREK: as ferramentas do próprio TREK estão ligadas diretamente (mcp__${TREK_SERVER}__<nome>, ex.: mcp__${TREK_SERVER}__list_trips). Usa-as em vez de trek_tools/trek_read/trek_write.`
        : agent.tools.some((tool) => TREK_PROXY_TOOLS.has(tool))
          ? `

O TREK: usa as ferramentas do MyHomeLab — trek_tools para ver o que há, trek_tool_help para os argumentos de uma, trek_read para ler e trek_write para mudar.`
          : '') +
      (openGym
        ? `

O openGym: as ferramentas do próprio openGym estão ligadas diretamente (mcp__${OPENGYM_SERVER}__<nome>, ex.: mcp__${OPENGYM_SERVER}__list_routines). Usa só essas; as opengym_* não estão disponíveis.`
        : '') +
      (stirling
        ? `

O Stirling-PDF: o MCP do próprio Stirling também está ligado (mcp__${STIRLING_SERVER}__<nome>). Para ficheiros do Paperless ou do Nextcloud, e para guardar o resultado lá, usa as stirling_* do MyHomeLab (stirling_run); o MCP serve para o resto que só ele tenha.`
        : '') +
      (giteaMirror
        ? `

O Gitea Mirror: o MCP do próprio Gitea Mirror também está ligado (mcp__${GITEA_MIRROR_SERVER}__<nome>, ex.: mcp__${GITEA_MIRROR_SERVER}__list_failures). Para o resumo, a atividade e importar do GitHub usa as gitea_mirror_*; o MCP serve para o que só ele tenha.`
        : '') +
      (coolify
        ? `

O Coolify: o MCP do próprio Coolify também está ligado (mcp__${COOLIFY_SERVER}__<nome>, ex.: mcp__${COOLIFY_SERVER}__get_infrastructure_overview). Para o resumo, os deploys, os logs e as variáveis usa as coolify_*; o MCP serve para o que só ele tenha (criar apps e bases de dados, backups das bases de dados, tarefas agendadas, proxy, DNS, rollback).`
        : ''),
    readFirst(
      guardTools(tools, context.deniedPermissions, {
        agentKey: agent.key,
        targets: context.appAccess,
      }),
      toRead,
      read,
    ),
    docs
      ? await withDocsToRead(
          messages,
          { ...context, agentKey: agent.key, docsUsed: read },
          toRead,
        )
      : messages,
    {
      onToolUse: (toolName, input) => {
        const action =
          toolAction(toolName) ??
          (toolName.startsWith(`mcp__${TREK_SERVER}__`)
            ? `no TREK: ${toolName.slice(`mcp__${TREK_SERVER}__`.length)}`
            : null) ??
          (toolName.startsWith(`mcp__${OPENGYM_SERVER}__`)
            ? `no openGym: ${toolName.slice(`mcp__${OPENGYM_SERVER}__`.length)}`
            : null) ??
          (toolName.startsWith(`mcp__${COOLIFY_SERVER}__`)
            ? `no Coolify: ${toolName.slice(`mcp__${COOLIFY_SERVER}__`.length)}`
            : null) ??
          (toolName.startsWith(`mcp__${GITEA_MIRROR_SERVER}__`)
            ? `no Gitea Mirror: ${toolName.slice(`mcp__${GITEA_MIRROR_SERVER}__`.length)}`
            : null) ??
          (toolName.startsWith(`mcp__${STIRLING_SERVER}__`)
            ? `no Stirling-PDF: ${toolName.slice(`mcp__${STIRLING_SERVER}__`.length)}`
            : null) ??
          delegationAction(toolName, members) ??
          `a usar ${toolName}`;
        const detail = actionDetail(input);
        context.actionsDone?.push(
          `${agent.name}: ${action}${detail ? ` (${detail})` : ''}`,
        );
        context.activity.update(context.userId, agent.key, action);
      },
      mcpServers: direct.length
        ? direct.reduce<Record<string, unknown>>(
            (all, entry) => ({ ...all, ...entry.servers }),
            {},
          )
        : undefined,
      allowedTools: direct.length
        ? direct.flatMap((entry) => entry.allowedTools)
        : undefined,
      onUsage: (usage) => {
        context.onUsage?.(usage);
        context.recordUsage?.(agent.key, usage);
      },
      queued,
      model: agent.model === 'OPUS' ? AGENT_MODEL : SUBAGENT_MODEL,
      // Com ficheiros na mensagem, o Jarvis pensa a sério: é para os analisar bem.
      effort:
        agent.effort === 'HIGH' || (depth === 0 && context.filesInTurn)
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
