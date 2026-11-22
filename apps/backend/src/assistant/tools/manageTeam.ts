import { HttpException } from '@nestjs/common';
import {
  Agent,
  AgentEffort,
  AgentModel,
} from 'src/generated/prisma/client/client';
import { TOOL_CATALOG } from 'src/agent/tool-catalog';
import { createTeamAgent } from 'src/agent/helpers/createTeamAgent';
import { updateTeamAgent } from 'src/agent/helpers/updateTeamAgent';
import { deleteTeamAgent } from 'src/agent/helpers/deleteTeamAgent';
import type { AgentContext } from '../agents/agent-context';
import type {
  AgentChangePayload,
  AgentToolChange,
} from 'src/chat-approval/chat-approval.types';

/** O que mudar a equipa precisa: também serve ao aprovar um cartão, fora de uma conversa. */
export type TeamContext = Pick<
  AgentContext,
  'userId' | 'team' | 'agentRepository'
>;

const normalize = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const GROUPS = [...new Set(TOOL_CATALOG.map((entry) => entry.group))];

/** Um agente pela chave ou pelo nome. */
function findAgent(context: TeamContext, wanted: string): Agent | string {
  const agent = context.team.find(
    (member) =>
      member.key === wanted.trim() ||
      normalize(member.name) === normalize(wanted),
  );
  return (
    agent ??
    `Não há nenhum agente "${wanted}". Os que existem: ${context.team.map((member) => `${member.key} (${member.name})`).join(', ')}.`
  );
}

/** Nomes de ferramentas e de grupos ("homeAssistant") → nomes de ferramentas, pela ordem do catálogo. */
function resolveTools(names: string[]): string[] | string {
  const wanted = new Set<string>();
  const unknown: string[] = [];
  for (const name of names.map((item) => item.trim()).filter(Boolean)) {
    const group = TOOL_CATALOG.filter((entry) => entry.group === name);
    if (group.length) group.forEach((entry) => wanted.add(entry.name));
    else if (TOOL_CATALOG.some((entry) => entry.name === name))
      wanted.add(name);
    else unknown.push(name);
  }
  if (unknown.length) {
    return `Não conheço estas ferramentas nem grupos: ${unknown.join(', ')}. Vê os que existem com list_available_tools.`;
  }
  return TOOL_CATALOG.filter((entry) => wanted.has(entry.name)).map(
    (entry) => entry.name,
  );
}

const reportsToName = (context: TeamContext, agent: Agent) =>
  context.team.find((member) => member.id === agent.reportsToId)?.name ??
  'ninguém (fala com o utilizador)';

/** Volta a ler a equipa, para as próximas ferramentas desta volta a verem já mudada. */
async function refreshTeam(context: TeamContext) {
  const team = await context.agentRepository.findTeam(context.userId);
  context.team.splice(0, context.team.length, ...team);
}

const failure = (error: unknown) => {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    return `Não deu: ${typeof response === 'string' ? response : ((response as { message?: string }).message ?? error.message)}`;
  }
  throw error;
};

export function listTeam(context: TeamContext): string {
  return context.team
    .map(
      (agent) =>
        `${agent.key} — ${agent.name}${agent.isActive ? '' : ' (desligado)'}\n` +
        `  responde a: ${reportsToName(context, agent)}; modelo ${agent.model}, esforço ${agent.effort}; ` +
        `instruções ${agent.template ? (agent.prompt ? 'do site, editadas' : 'do site') : 'próprias'}${agent.extraPrompt ? ' + extra' : ''}\n` +
        `  faz: ${agent.description}\n` +
        `  ferramentas: ${agent.tools.length ? agent.tools.join(', ') : 'nenhuma (só delega)'}`,
    )
    .join('\n');
}

export function listAvailableTools(): string {
  return GROUPS.map(
    (group) =>
      `${group}: ${TOOL_CATALOG.filter((entry) => entry.group === group)
        .map(
          (entry) =>
            `${entry.name} (${entry.access === 'read' ? 'lê' : 'altera'}: ${entry.action.replace(/^a /, '')})`,
        )
        .join('; ')}`,
  ).join('\n');
}

/** As ferramentas depois de uma mudança (todas, acrescentar, tirar); undefined = ficam. */
function nextTools(
  agent: Agent,
  input: { tools?: string[]; add_tools?: string[]; remove_tools?: string[] },
): string[] | string | undefined {
  if (!input.tools && !input.add_tools && !input.remove_tools) return undefined;
  const base = input.tools ? resolveTools(input.tools) : agent.tools;
  if (typeof base === 'string') return base;
  const added = resolveTools(input.add_tools ?? []);
  if (typeof added === 'string') return added;
  const removed = resolveTools(input.remove_tools ?? []);
  if (typeof removed === 'string') return removed;
  const next = new Set(
    [...base, ...added].filter((name) => !removed.includes(name)),
  );
  return TOOL_CATALOG.filter((entry) => next.has(entry.name)).map(
    (entry) => entry.name,
  );
}

interface AgentInput {
  name?: string;
  description?: string;
  prompt?: string;
  model?: AgentModel;
  effort?: AgentEffort;
  tools?: string[];
  reports_to?: string;
  active?: boolean;
}

export async function createAgent(
  input: AgentInput & { name: string; description: string; prompt: string },
  context: TeamContext,
): Promise<string> {
  const tools = resolveTools(input.tools ?? []);
  if (typeof tools === 'string') return tools;
  const boss = input.reports_to ? findAgent(context, input.reports_to) : null;
  if (typeof boss === 'string') return boss;

  const used = new Set(context.team.map((member) => member.color));
  const color = [1, 2, 3, 4, 5, 6, 7, 8].find((item) => !used.has(item)) ?? 1;

  try {
    const agent = await createTeamAgent(
      {
        name: input.name,
        description: input.description,
        prompt: input.prompt,
        model: input.model ?? 'SONNET',
        effort: input.effort ?? 'LOW',
        tools,
        reportsToId: boss?.id,
        color,
        isActive: input.active ?? true,
      },
      context.agentRepository,
      context.userId,
    );
    await refreshTeam(context);
    return (
      `Criado o agente ${agent.name} (chave ${agent.key}), a responder a ${reportsToName(context, agent)}, ` +
      `modelo ${agent.model}, esforço ${agent.effort}, com ${agent.tools.length} ferramentas: ${agent.tools.join(', ') || 'nenhuma'}. ` +
      'Fica disponível a partir da próxima mensagem e aparece em Assistente → Workflow.'
    );
  } catch (error) {
    return failure(error);
  }
}

export async function updateAgent(
  input: AgentInput & {
    agent: string;
    add_tools?: string[];
    remove_tools?: string[];
  },
  context: TeamContext,
): Promise<string> {
  const agent = findAgent(context, input.agent);
  if (typeof agent === 'string') return agent;
  if (!agent.reportsToId) {
    return 'O CEO (tu) não se muda por aqui: as tuas ferramentas, o modelo e o lugar mudam-se no site, em Assistente → Workflow.';
  }

  const tools = nextTools(agent, input);
  if (typeof tools === 'string') return tools;
  const boss = input.reports_to ? findAgent(context, input.reports_to) : null;
  if (typeof boss === 'string') return boss;

  try {
    const updated = await updateTeamAgent(
      agent.id,
      {
        name: input.name,
        description: input.description,
        prompt: input.prompt,
        model: input.model,
        effort: input.effort,
        tools,
        reportsToId: boss?.id,
        isActive: input.active,
      },
      context.agentRepository,
      context.userId,
    );
    await refreshTeam(context);
    return (
      `${updated.name} (${updated.key}) atualizado: responde a ${reportsToName(context, updated)}, ` +
      `modelo ${updated.model}, esforço ${updated.effort}, ${updated.isActive ? 'ligado' : 'desligado'}, ` +
      `ferramentas: ${updated.tools.join(', ') || 'nenhuma'}. Vale a partir da próxima mensagem.`
    );
  } catch (error) {
    return failure(error);
  }
}

export async function deleteAgent(
  input: { agent: string },
  context: TeamContext,
): Promise<string> {
  const agent = findAgent(context, input.agent);
  if (typeof agent === 'string') return agent;
  try {
    await deleteTeamAgent(agent.id, context.agentRepository, context.userId);
    await refreshTeam(context);
    return `Apagado o agente ${agent.name} (${agent.key}). Quem lhe respondia passa a responder a ${reportsToName(context, agent)}.`;
  } catch (error) {
    return failure(error);
  }
}

const toolChange = (name: string): AgentToolChange => ({
  name,
  write: TOOL_CATALOG.find((entry) => entry.name === name)?.access === 'write',
});

type CreateInput = AgentInput & {
  name: string;
  description: string;
  prompt: string;
};

type UpdateInput = AgentInput & {
  agent: string;
  add_tools?: string[];
  remove_tools?: string[];
};

/**
 * O que create_agent, update_agent e delete_agent iam fazer, sem o fazer: valida o
 * pedido e devolve o resumo do cartão que ele aprova (ou o erro, para o modelo).
 */
export function planAgentChange(
  action: AgentChangePayload['action'],
  input: Record<string, unknown>,
  context: TeamContext,
): AgentChangePayload | string {
  if (action === 'create') {
    const create = input as unknown as CreateInput;
    const tools = resolveTools(create.tools ?? []);
    if (typeof tools === 'string') return tools;
    const boss = create.reports_to
      ? findAgent(context, create.reports_to)
      : null;
    if (typeof boss === 'string') return boss;
    if (!create.name?.trim() || !create.prompt?.trim()) {
      return 'Um agente novo precisa de nome e de instruções.';
    }
    return {
      action,
      agentName: create.name.trim(),
      input,
      addedTools: tools.map(toolChange),
      removedTools: [],
      promptAfter: create.prompt,
      changes: [
        {
          field: 'reportsTo',
          before: null,
          after:
            boss?.name ??
            context.team.find((member) => !member.reportsToId)?.name ??
            null,
        },
        { field: 'model', before: null, after: create.model ?? 'SONNET' },
      ],
    };
  }
  const agent = findAgent(
    context,
    typeof input.agent === 'string' ? input.agent : '',
  );
  if (typeof agent === 'string') return agent;
  if (!agent.reportsToId) {
    return 'O CEO (tu) não se muda por aqui: as tuas ferramentas, o modelo e o lugar mudam-se no site, em Assistente → Workflow.';
  }
  if (action === 'delete') {
    return {
      action,
      agentKey: agent.key,
      agentName: agent.name,
      input,
      addedTools: [],
      removedTools: [],
      changes: [],
    };
  }
  const update = input as unknown as UpdateInput;
  const tools = nextTools(agent, update);
  if (typeof tools === 'string') return tools;
  const boss = update.reports_to ? findAgent(context, update.reports_to) : null;
  if (typeof boss === 'string') return boss;
  const changes: AgentChangePayload['changes'] = [];
  const field = (
    name: string,
    before: string | null,
    after: string | null | undefined,
  ) => {
    if (after !== undefined && after !== before) {
      changes.push({ field: name, before, after });
    }
  };
  field('name', agent.name, update.name?.trim());
  field('description', agent.description, update.description?.trim());
  field('model', agent.model, update.model);
  field('effort', agent.effort, update.effort);
  field('reportsTo', reportsToName(context, agent), boss?.name);
  field(
    'active',
    agent.isActive ? 'on' : 'off',
    update.active === undefined ? undefined : update.active ? 'on' : 'off',
  );
  const promptChanged =
    update.prompt !== undefined && update.prompt !== (agent.prompt ?? '');
  return {
    action,
    agentKey: agent.key,
    agentName: agent.name,
    input,
    addedTools: (tools ?? [])
      .filter((name) => !agent.tools.includes(name))
      .map(toolChange),
    removedTools: tools
      ? agent.tools.filter((name) => !tools.includes(name))
      : [],
    promptBefore: promptChanged ? agent.prompt : undefined,
    promptAfter: promptChanged ? update.prompt : undefined,
    changes,
  };
}

/** Faz o que o cartão aprovado diz (volta a validar contra a equipa de agora). */
export function applyAgentChange(
  payload: AgentChangePayload,
  context: TeamContext,
): Promise<string> {
  if (payload.action === 'create') {
    return createAgent(payload.input as unknown as CreateInput, context);
  }
  if (payload.action === 'delete') {
    return deleteAgent({ agent: payload.agentKey ?? '' }, context);
  }
  return updateAgent(
    {
      ...(payload.input as unknown as UpdateInput),
      agent: payload.agentKey ?? '',
    },
    context,
  );
}
