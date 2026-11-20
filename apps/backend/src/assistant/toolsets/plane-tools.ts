import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import {
  createPlaneClient,
  PlaneClient,
  PlaneCycle,
  PlaneModule,
  PlaneMember,
  PlaneProject,
  PlaneState,
  PlaneWorkItem,
  PlaneWorkItemInput,
} from 'src/plane/plane.client';

const fold = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const describe = (error: unknown) =>
  `Falhou: ${error instanceof Error ? error.message : String(error)}`;

const ACCOUNT = {
  type: 'string' as const,
  description: 'O Plane (nome ou espaço de trabalho). Omite quando só há um.',
};

const ITEM = {
  type: 'string' as const,
  description: 'A tarefa pela chave, ex.: "WEB-12".',
};

const PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none'];

const FIELDS = {
  description: {
    type: 'string' as const,
    description: 'Texto; parágrafos separados por linhas em branco.',
  },
  state: {
    type: 'string' as const,
    description: 'O estado pelo nome (ex.: "In Progress").',
  },
  priority: { type: 'string' as const, enum: PRIORITIES },
  assignees: {
    type: 'array' as const,
    items: { type: 'string' as const },
    description: 'Pessoas pelo nome ou email; a lista substitui a anterior.',
  },
  labels: {
    type: 'array' as const,
    items: { type: 'string' as const },
    description: 'Etiquetas pelo nome; a lista substitui a anterior.',
  },
  start_date: {
    type: 'string' as const,
    description: '"AAAA-MM-DD" (vazio tira).',
  },
  due_date: {
    type: 'string' as const,
    description: '"AAAA-MM-DD" (vazio tira).',
  },
  parent: {
    type: 'string' as const,
    description: 'A tarefa mãe pela chave (vazio tira).',
  },
};

interface ItemFields {
  title?: string;
  description?: string;
  state?: string;
  priority?: string;
  assignees?: string[];
  labels?: string[];
  start_date?: string;
  due_date?: string;
  parent?: string;
}

/** Texto simples em HTML para o Plane (parágrafos e quebras de linha). */
export function planeHtml(text: string): string {
  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${escape(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

const day = (value?: string) =>
  value === undefined ? undefined : value.trim() ? value.trim() : null;

const memberName = (member: PlaneMember) =>
  member.display_name ||
  [member.first_name, member.last_name].filter(Boolean).join(' ') ||
  member.email ||
  member.id;

/** O Plane a usar: o único, ou o que bate com o nome ou o espaço pedido. */
async function planeTarget(
  context: AgentContext,
  wanted?: string,
): Promise<ConnectedAccount | string> {
  const accounts = (
    await context.connectedAccountRepository.findAllByUser(
      context.userId,
      ConnectionProvider.PLANE,
    )
  ).filter(
    (account) =>
      account.isActive &&
      account.baseUrl &&
      account.accessToken &&
      account.username,
  );
  if (!accounts.length) {
    return 'Não há nenhum Plane ligado. Liga-o em Apps ligadas → Plane.';
  }
  const label = (account: ConnectedAccount) =>
    `${account.displayName ?? 'Plane'} (espaço ${account.username})`;
  const matches = wanted?.trim()
    ? accounts.filter((account) => fold(label(account)).includes(fold(wanted)))
    : accounts;
  if (matches.length !== 1) {
    return `Diz qual o Plane: ${accounts.map(label).join(', ')}.`;
  }
  return matches[0];
}

export function buildPlaneTools(context: AgentContext): AgentTool[] {
  const run =
    <T>(work: (plane: PlaneClient, input: T) => Promise<string>) =>
    async (input: T & { account?: string }) => {
      const account = await planeTarget(context, input.account);
      if (typeof account === 'string') return account;
      try {
        return await work(
          createPlaneClient(
            account.baseUrl ?? '',
            account.accessToken ?? '',
            account.username ?? '',
          ),
          input,
        );
      } catch (error) {
        return describe(error);
      }
    };

  async function projectOf(plane: PlaneClient, wanted: string) {
    const projects = await plane.projects();
    const key = fold(wanted);
    const found =
      projects.find(
        (project) =>
          fold(project.identifier) === key || fold(project.name) === key,
      ) ?? projects.filter((project) => fold(project.name).includes(key));
    if (!Array.isArray(found)) return found;
    if (found.length === 1) return found[0];
    throw new Error(
      `não há o projeto «${wanted}». Os projetos são: ${projects.map((project) => `${project.name} (${project.identifier})`).join(', ')}`,
    );
  }

  /** A tarefa pela chave, com o projeto dela. */
  async function itemOf(plane: PlaneClient, key: string) {
    const item = await plane.workItemByKey(key.trim());
    const projects = await plane.projects();
    const project = projects.find((entry) => entry.id === item.project);
    if (!project) throw new Error(`não encontrei o projeto de ${key}`);
    return { item, project };
  }

  /** Os nomes (estado, pessoas, etiquetas) em ids, com o erro a dizer as opções. */
  async function toInput(
    plane: PlaneClient,
    project: PlaneProject,
    fields: ItemFields,
  ): Promise<PlaneWorkItemInput> {
    const input: PlaneWorkItemInput = {};
    if (fields.title !== undefined) input.name = fields.title;
    if (fields.description !== undefined)
      input.description_html = planeHtml(fields.description);
    if (fields.priority !== undefined) {
      if (!PRIORITIES.includes(fields.priority))
        throw new Error(`a prioridade é ${PRIORITIES.join(', ')}`);
      input.priority = fields.priority;
    }
    if (fields.state !== undefined) {
      const states = await plane.states(project.id);
      const state = states.find(
        (entry) => fold(entry.name) === fold(fields.state!),
      );
      if (!state)
        throw new Error(
          `não há o estado «${fields.state}» em ${project.name}: ${states.map((entry) => entry.name).join(', ')}`,
        );
      input.state = state.id;
    }
    if (fields.assignees !== undefined) {
      const members = await plane.members();
      input.assignees = fields.assignees.map((wanted) => {
        const member = members.find(
          (entry) =>
            fold(memberName(entry)) === fold(wanted) ||
            fold(entry.email ?? '') === fold(wanted),
        );
        if (!member)
          throw new Error(
            `não há a pessoa «${wanted}»: ${members.map(memberName).join(', ')}`,
          );
        return member.id;
      });
    }
    if (fields.labels !== undefined) {
      const labels = await plane.labels(project.id);
      input.labels = fields.labels.map((wanted) => {
        const label = labels.find((entry) => fold(entry.name) === fold(wanted));
        if (!label)
          throw new Error(
            `não há a etiqueta «${wanted}» em ${project.name}: ${labels.map((entry) => entry.name).join(', ') || 'nenhuma'}`,
          );
        return label.id;
      });
    }
    if (fields.start_date !== undefined)
      input.start_date = day(fields.start_date);
    if (fields.due_date !== undefined) input.target_date = day(fields.due_date);
    if (fields.parent !== undefined) {
      input.parent = fields.parent.trim()
        ? (await plane.workItemByKey(fields.parent.trim())).id
        : null;
    }
    return input;
  }

  const line = (
    item: PlaneWorkItem,
    project: PlaneProject,
    states: Map<string, PlaneState>,
    people: Map<string, string>,
  ) =>
    `- ${project.identifier}-${item.sequence_id} «${item.name}» — ${states.get(item.state)?.name ?? '?'}, prioridade ${item.priority}${item.assignees.length ? `, ${item.assignees.map((id) => people.get(id) ?? '?').join(', ')}` : ''}${item.target_date ? `, até ${item.target_date}` : ''}`;

  return [
    {
      name: 'plane_overview',
      description:
        'O Plane (gestão de projetos): o espaço de trabalho, os projetos (nome e prefixo das chaves) e, em cada um, quantas tarefas estão abertas.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (plane) => {
        const [me, projects] = await Promise.all([
          plane.me(),
          plane.projects(),
        ]);
        const open = projects.filter((project) => !project.archived_at);
        const lines: string[] = [];
        for (const project of open.slice(0, 8)) {
          const [states, items] = await Promise.all([
            plane.states(project.id),
            plane.workItems(project.id, 1000),
          ]);
          const done = new Set(
            states
              .filter((state) =>
                ['completed', 'cancelled'].includes(state.group),
              )
              .map((state) => state.id),
          );
          lines.push(
            `- ${project.name} (${project.identifier}): ${items.filter((item) => !done.has(item.state)).length} abertas de ${items.length}`,
          );
        }
        return [
          `Plane de ${me.display_name}: ${open.length} projetos.`,
          ...lines,
          open.length > 8
            ? `(e mais ${open.length - 8}: ${open
                .slice(8)
                .map((project) => `${project.name} (${project.identifier})`)
                .join(', ')})`
            : '',
        ]
          .filter(Boolean)
          .join('\n');
      }),
    },
    {
      name: 'plane_project',
      description:
        'Um projeto do Plane por dentro: os estados (por grupo), as etiquetas, os ciclos, os módulos e as pessoas do espaço. Usa antes de criar ou mudar tarefas, para os nomes certos.',
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'O nome ou o prefixo (ex.: "WEB").',
          },
          account: ACCOUNT,
        },
        required: ['project'],
      },
      handler: run(async (plane, input: { project: string }) => {
        const project = await projectOf(plane, input.project);
        const [states, labels, cycles, modules, members] = await Promise.all([
          plane.states(project.id),
          plane.labels(project.id),
          plane.cycles(project.id).catch((): PlaneCycle[] => []),
          plane.modules(project.id).catch((): PlaneModule[] => []),
          plane.members(),
        ]);
        return [
          `${project.name} (${project.identifier})${project.description ? ` — ${project.description}` : ''}`,
          `Estados: ${states.map((state) => `${state.name} (${state.group})`).join(', ')}`,
          `Etiquetas: ${labels.map((label) => label.name).join(', ') || 'nenhuma'}`,
          `Ciclos: ${cycles.map((cycle) => `${cycle.name}${cycle.start_date ? ` ${cycle.start_date}→${cycle.end_date ?? '?'}` : ''}`).join(', ') || 'nenhum'}`,
          `Módulos: ${modules.map((module) => module.name).join(', ') || 'nenhum'}`,
          `Pessoas: ${members.map(memberName).join(', ')}`,
        ].join('\n');
      }),
    },
    {
      name: 'plane_list',
      description:
        'As tarefas de um projeto do Plane (as mais recentes primeiro), com chave, estado, prioridade, responsáveis e prazo. Por omissão só as abertas; filtra por estado, pessoa, prioridade ou texto no título.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          state: { type: 'string' },
          assignee: { type: 'string' },
          priority: { type: 'string', enum: PRIORITIES },
          text: { type: 'string' },
          all: {
            type: 'boolean',
            description: 'Também as feitas e canceladas.',
          },
          limit: { type: 'integer', description: 'Até 200 (omissão 50).' },
          account: ACCOUNT,
        },
        required: ['project'],
      },
      handler: run(
        async (
          plane,
          input: {
            project: string;
            state?: string;
            assignee?: string;
            priority?: string;
            text?: string;
            all?: boolean;
            limit?: number;
          },
        ) => {
          const project = await projectOf(plane, input.project);
          const [states, members, items] = await Promise.all([
            plane.states(project.id),
            plane.members(),
            plane.workItems(project.id, 1000),
          ]);
          const byId = new Map(states.map((state) => [state.id, state]));
          const people = new Map(
            members.map((member) => [member.id, memberName(member)]),
          );
          const person = input.assignee
            ? members.find(
                (member) =>
                  fold(memberName(member)).includes(fold(input.assignee!)) ||
                  fold(member.email ?? '') === fold(input.assignee!),
              )
            : undefined;
          if (input.assignee && !person)
            return `Não há a pessoa «${input.assignee}».`;
          const found = items.filter((item) => {
            const state = byId.get(item.state);
            if (input.state) {
              if (!state || fold(state.name) !== fold(input.state))
                return false;
            } else if (
              !input.all &&
              state &&
              ['completed', 'cancelled'].includes(state.group)
            )
              return false;
            if (person && !item.assignees.includes(person.id)) return false;
            if (input.priority && item.priority !== input.priority)
              return false;
            if (input.text && !fold(item.name).includes(fold(input.text)))
              return false;
            return true;
          });
          const limit = Math.min(input.limit ?? 50, 200);
          if (!found.length) return `Nenhuma tarefa em ${project.name}.`;
          return [
            `${project.name}: ${found.length} tarefas${found.length > limit ? ` (mostro ${limit})` : ''}.`,
            ...found
              .slice(0, limit)
              .map((item) => line(item, project, byId, people)),
          ].join('\n');
        },
      ),
    },
    {
      name: 'plane_get',
      description:
        'Uma tarefa do Plane inteira pela chave (ex.: "WEB-12"): descrição, estado, prioridade, responsáveis, etiquetas, datas e os comentários.',
      inputSchema: {
        type: 'object',
        properties: { item: ITEM, account: ACCOUNT },
        required: ['item'],
      },
      handler: run(async (plane, input: { item: string }) => {
        const { item, project } = await itemOf(plane, input.item);
        const [states, labels, members, comments] = await Promise.all([
          plane.states(project.id),
          plane.labels(project.id),
          plane.members(),
          plane.comments(project.id, item.id),
        ]);
        const people = new Map(
          members.map((member) => [member.id, memberName(member)]),
        );
        const strip = (html?: string) =>
          (html ?? '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .trim();
        return [
          `${project.identifier}-${item.sequence_id} «${item.name}» (${project.name})`,
          `Estado: ${states.find((state) => state.id === item.state)?.name ?? '?'} · prioridade ${item.priority}`,
          `Responsáveis: ${item.assignees.map((id) => people.get(id) ?? '?').join(', ') || 'ninguém'}`,
          `Etiquetas: ${item.labels.map((id) => labels.find((label) => label.id === id)?.name ?? '?').join(', ') || 'nenhuma'}`,
          `Datas: início ${item.start_date ?? '—'}, prazo ${item.target_date ?? '—'} · criada ${item.created_at.slice(0, 10)}, mudou ${item.updated_at.slice(0, 16).replace('T', ' ')}`,
          '',
          item.description_stripped?.trim() ||
            strip(item.description_html) ||
            'Sem descrição.',
          '',
          comments.length
            ? `Comentários:\n${comments
                .map(
                  (comment) =>
                    `- ${comment.created_at.slice(0, 16).replace('T', ' ')} ${people.get(comment.actor ?? comment.created_by ?? '') ?? ''}: ${comment.comment_stripped?.trim() || strip(comment.comment_html)}`,
                )
                .join('\n')}`
            : 'Sem comentários.',
        ].join('\n');
      }),
    },
    {
      name: 'plane_search',
      description:
        'Procura tarefas no espaço do Plane todo pelo título ou pela chave. Devolve as chaves para usar em plane_get.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' }, account: ACCOUNT },
        required: ['query'],
      },
      handler: run(async (plane, input: { query: string }) => {
        const found = await plane.search(input.query);
        return found.length
          ? found
              .map(
                (item) =>
                  `- ${item.project__identifier}-${item.sequence_id} «${item.name}»`,
              )
              .join('\n')
          : 'Não encontrei nada.';
      }),
    },
    {
      name: 'plane_create',
      description:
        'Cria uma tarefa num projeto do Plane. Os nomes (estado, pessoas, etiquetas) são os de plane_project. Cria só quando ele pedir ou os documentos o disserem.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          title: { type: 'string' },
          ...FIELDS,
          account: ACCOUNT,
        },
        required: ['project', 'title'],
      },
      handler: run(
        async (
          plane,
          input: ItemFields & { project: string; title: string },
        ) => {
          const project = await projectOf(plane, input.project);
          const item = await plane.createWorkItem(
            project.id,
            await toInput(plane, project, input),
          );
          return `Criei ${project.identifier}-${item.sequence_id} «${item.name}» em ${project.name}.`;
        },
      ),
    },
    {
      name: 'plane_update',
      description:
        'Muda uma tarefa do Plane pela chave: o título, a descrição, o estado, a prioridade, os responsáveis, as etiquetas, as datas ou a mãe. Só o que mandares muda; diz o antes → depois.',
      inputSchema: {
        type: 'object',
        properties: {
          item: ITEM,
          title: { type: 'string' },
          ...FIELDS,
          account: ACCOUNT,
        },
        required: ['item'],
      },
      handler: run(async (plane, input: ItemFields & { item: string }) => {
        const { item, project } = await itemOf(plane, input.item);
        const changes = await toInput(plane, project, input);
        if (!Object.keys(changes).length) return 'Não disseste o que mudar.';
        const states = await plane.states(project.id);
        const stateName = (id: string) =>
          states.find((state) => state.id === id)?.name ?? '?';
        const updated = await plane.updateWorkItem(
          project.id,
          item.id,
          changes,
        );
        const notes = [
          changes.name !== undefined &&
            `título «${item.name}» → «${updated.name}»`,
          changes.state !== undefined &&
            `estado ${stateName(item.state)} → ${stateName(updated.state)}`,
          changes.priority !== undefined &&
            `prioridade ${item.priority} → ${updated.priority}`,
          changes.target_date !== undefined &&
            `prazo ${item.target_date ?? '—'} → ${updated.target_date ?? '—'}`,
          changes.start_date !== undefined &&
            `início ${item.start_date ?? '—'} → ${updated.start_date ?? '—'}`,
          changes.assignees !== undefined && 'responsáveis',
          changes.labels !== undefined && 'etiquetas',
          changes.description_html !== undefined && 'descrição',
          changes.parent !== undefined && 'tarefa mãe',
        ].filter(Boolean);
        return `Mudei ${project.identifier}-${item.sequence_id}: ${notes.join('; ')}.`;
      }),
    },
    {
      name: 'plane_comment',
      description: 'Comenta uma tarefa do Plane pela chave.',
      inputSchema: {
        type: 'object',
        properties: {
          item: ITEM,
          text: { type: 'string' },
          account: ACCOUNT,
        },
        required: ['item', 'text'],
      },
      handler: run(async (plane, input: { item: string; text: string }) => {
        if (!input.text?.trim()) return 'Falta o texto do comentário.';
        const { item, project } = await itemOf(plane, input.item);
        await plane.addComment(project.id, item.id, planeHtml(input.text));
        return `Comentei ${project.identifier}-${item.sequence_id} «${item.name}».`;
      }),
    },
  ];
}
