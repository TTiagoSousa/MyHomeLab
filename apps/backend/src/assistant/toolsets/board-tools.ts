import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import { TaskPriority } from 'src/generated/prisma/client/client';

const TASK = {
  type: 'string' as const,
  description: 'A tarefa: a chave (ex.: "ATU-12") ou o id.',
};

const PRIORITIES = Object.values(TaskPriority);

const lisbonDay = (date: Date | null) =>
  date ? date.toLocaleDateString('pt-PT', { timeZone: 'Europe/Lisbon' }) : null;

const parseDay = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  if (!value) return null;
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T09:00:00Z` : value,
  );
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const failure = (error: unknown) =>
  `Não deu: ${error instanceof Error ? error.message : String(error)}`;

interface TaskFields {
  project?: string;
  title?: string;
  description?: string;
  state?: string;
  priority?: TaskPriority;
  assignee?: string | null;
  labels?: string[];
  modules?: string[];
  start_date?: string | null;
  due_date?: string | null;
  parent?: string | null;
}

const FIELDS = {
  title: { type: 'string' as const },
  description: {
    type: 'string' as const,
    description: 'Markdown: o que é, o objetivo, o que está feito.',
  },
  state: {
    type: 'string' as const,
    description: 'A coluna, pelo nome (ex.: "Em curso", "Ready to update").',
  },
  priority: { type: 'string' as const, enum: PRIORITIES },
  assignee: {
    type: 'string' as const,
    description:
      'Quem trata: "user" (ele) ou a chave de um agente. Os comentários dele põem esse agente a trabalhar.',
  },
  labels: { type: 'array' as const, items: { type: 'string' as const } },
  modules: {
    type: 'array' as const,
    items: { type: 'string' as const },
    description:
      'Os módulos, pelo nome (criam-se se faltarem). No update, a lista substitui a anterior.',
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
    description: 'A tarefa mãe (chave), para uma sub-tarefa.',
  },
};

/** O quadro de tarefas (Projetos): ver, criar, mudar, comentar e pedir respostas. */
export function buildBoardTools(context: AgentContext): AgentTool[] {
  const agentKey = context.agentKey ?? 'ceo';
  const { board, userId } = context;

  const findTask = async (ref: string) => board.findForAgent(userId, ref);

  const projectOf = async (name?: string) => {
    const projects = await board.projects(userId);
    if (!name)
      return (
        projects.find((project) => project.kind === 'GENERAL') ?? projects[0]
      );
    const wanted = name.trim().toLowerCase();
    return projects.find(
      (project) =>
        project.name.toLowerCase() === wanted ||
        project.identifier.toLowerCase() === wanted,
    );
  };

  const toInput = async (
    input: TaskFields,
    project: Awaited<ReturnType<typeof board.project>>,
  ) => {
    const state = input.state
      ? project.states.find(
          (item) =>
            item.name.toLowerCase() === input.state!.trim().toLowerCase(),
        )
      : undefined;
    if (input.state && !state) {
      return `Não há a coluna "${input.state}" em ${project.name}: ${project.states.map((item) => item.name).join(', ')}.`;
    }
    let parentId: string | null | undefined = undefined;
    if (input.parent !== undefined) {
      if (!input.parent) parentId = null;
      else {
        const parent = await findTask(input.parent);
        if (typeof parent === 'string') return parent;
        parentId = parent.id;
      }
    }
    return {
      title: input.title,
      description: input.description,
      stateId: state?.id,
      priority: input.priority,
      assignee: input.assignee === '' ? null : input.assignee,
      labels: input.labels,
      moduleNames: input.modules,
      startDate: parseDay(input.start_date),
      dueDate: parseDay(input.due_date),
      parentId,
    };
  };

  return [
    {
      name: 'board_list',
      description:
        'As tarefas do quadro (Projetos): de um projeto, de uma coluna, por pesquisa. Sem filtros: as abertas de todos os projetos.',
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'O projeto (nome ou prefixo, ex.: "ATU").',
          },
          state: { type: 'string', description: 'A coluna (nome).' },
          search: { type: 'string' },
          assignee: { type: 'string' },
          all: {
            type: 'boolean',
            description: 'Também as feitas e canceladas.',
          },
        },
      },
      handler: async (input: {
        project?: string;
        state?: string;
        search?: string;
        assignee?: string;
        all?: boolean;
      }) => {
        const projects = await board.projects(userId);
        const project = input.project
          ? await projectOf(input.project)
          : undefined;
        if (input.project && !project) {
          return `Não há o projeto "${input.project}": ${projects.map((item) => `${item.name} (${item.identifier})`).join(', ')}.`;
        }
        const state =
          project && input.state
            ? project.states.find(
                (item) =>
                  item.name.toLowerCase() === input.state!.toLowerCase(),
              )
            : undefined;
        const tasks = await board.tasks(userId, {
          projectId: project?.id,
          stateId: state?.id,
          search: input.search,
          assignee: input.assignee,
          open: !input.all,
        });
        const header = `Projetos: ${projects.map((item) => `${item.name} (${item.identifier}, ${item.openCount} abertas)`).join(' · ')}`;
        if (!tasks.length)
          return `${header}\n\nNenhuma tarefa com esses filtros.`;
        return [
          header,
          '',
          ...tasks
            .slice(0, 150)
            .map(
              (task) =>
                `- ${task.key} · ${task.state.name} · ${task.title}` +
                (task.priority !== 'NONE' ? ` · ${task.priority}` : '') +
                (task.assignee ? ` · ${task.assignee}` : '') +
                (task.dueDate ? ` · prazo ${lisbonDay(task.dueDate)}` : '') +
                (task.modules.length
                  ? ` · ${task.modules.map((item) => item.name).join(', ')}`
                  : ''),
            ),
        ].join('\n');
      },
    },
    {
      name: 'board_get',
      description:
        'Uma tarefa por inteiro: a descrição, a coluna, os comentários (o que ele pediu), os links, os documentos ligados, os disparos e a atualização (se for de uma).',
      inputSchema: {
        type: 'object',
        properties: { task: TASK },
        required: ['task'],
      },
      handler: async (input: { task: string }) => {
        const found = await findTask(input.task);
        if (typeof found === 'string') return found;
        const task = await board.task(userId, found.id);
        return [
          `${task.key} · ${task.title}`,
          `Projeto ${task.project.name} · coluna ${task.state.name} · prioridade ${task.priority}` +
            (task.assignee ? ` · responsável ${task.assignee}` : '') +
            (task.startDate ? ` · início ${lisbonDay(task.startDate)}` : '') +
            (task.dueDate ? ` · prazo ${lisbonDay(task.dueDate)}` : ''),
          task.modules.length
            ? `Módulos: ${task.modules.map((item) => item.name).join(', ')}`
            : null,
          task.labels.length ? `Etiquetas: ${task.labels.join(', ')}` : null,
          task.parent
            ? `Sub-tarefa de ${task.parent.key} ${task.parent.title}`
            : null,
          task.children.length
            ? `Sub-tarefas:\n${task.children.map((child) => `  - ${child.key} · ${child.state.name} · ${child.title}`).join('\n')}`
            : null,
          task.update
            ? `Atualização ${task.update.id}: ${task.update.fromVersion} → ${task.update.toVersion}, ${task.update.status}${task.update.question ? ` · pergunta: ${task.update.question}` : ''}`
            : null,
          '',
          task.description || '(sem descrição)',
          task.docs.length
            ? `\nDocumentos ligados:\n${task.docs.map((doc) => `  - ${doc.title} (${doc.id})`).join('\n')}`
            : null,
          task.links.length
            ? `\nLinks:\n${task.links.map((link) => `  - ${link.title}: ${link.url}`).join('\n')}`
            : null,
          task.schedules.length
            ? `\nDisparos:\n${task.schedules.map((item) => `  - "${item.title}" (${item.id}) ${item.enabled ? 'ligado' : 'desligado'}`).join('\n')}`
            : null,
          task.comments.length
            ? `\nComentários:\n${task.comments
                .slice(-30)
                .map(
                  (comment) =>
                    `  [${comment.createdAt.toISOString().slice(0, 16).replace('T', ' ')}] ${comment.author === 'user' ? 'ELE' : comment.author}: ${comment.body}`,
                )
                .join('\n')}`
            : '\nSem comentários.',
        ]
          .filter((line) => line !== null)
          .join('\n');
      },
    },
    {
      name: 'board_create',
      description:
        'Cria uma tarefa no quadro. Cria só quando ele pedir ou quando os documentos o disserem.',
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description:
              'O projeto (nome ou prefixo). Omissão: o primeiro projeto geral.',
          },
          ...FIELDS,
        },
        required: ['title'],
      },
      handler: async (input: TaskFields) => {
        const project = await projectOf(input.project);
        if (!project) return `Não há o projeto "${input.project}".`;
        const full = await board.project(userId, project.id);
        const data = await toInput(input, full);
        if (typeof data === 'string') return data;
        try {
          const task = await board.createTask(
            userId,
            { ...data, projectId: project.id },
            agentKey,
          );
          return `Criada ${task.key} "${task.title}" em ${project.name} (${task.state.name}).`;
        } catch (error) {
          return failure(error);
        }
      },
    },
    {
      name: 'board_update',
      description:
        'Muda uma tarefa (coluna, prioridade, responsável, datas, módulos…). Só o que mandares muda.',
      inputSchema: {
        type: 'object',
        properties: { task: TASK, ...FIELDS },
        required: ['task'],
      },
      handler: async (input: TaskFields & { task: string }) => {
        const found = await findTask(input.task);
        if (typeof found === 'string') return found;
        const project = await board.project(userId, found.projectId);
        const data = await toInput(input, project);
        if (typeof data === 'string') return data;
        try {
          const task = await board.updateTask(userId, found.id, data, agentKey);
          return `Mudada ${task.key}: ${task.state.name} · ${task.title}.`;
        } catch (error) {
          return failure(error);
        }
      },
    },
    {
      name: 'board_comment',
      description:
        'Escreve um comentário na tarefa (o que fizeste, o que viste). Ele lê no quadro.',
      inputSchema: {
        type: 'object',
        properties: {
          task: TASK,
          text: { type: 'string', description: 'Markdown.' },
        },
        required: ['task', 'text'],
      },
      handler: async (input: { task: string; text: string }) => {
        const found = await findTask(input.task);
        if (typeof found === 'string') return found;
        try {
          await board.comment(userId, found.id, input.text, agentKey);
          return 'Comentário escrito.';
        } catch (error) {
          return failure(error);
        }
      },
    },
    {
      name: 'board_ask_user',
      description:
        'Precisas de uma resposta dele numa tarefa: fica o comentário com a pergunta, a tarefa passa a esperar por ele e abre-se "Responder: …" em Tarefas. Ele responde na tarefa ou no chat. Usa-o quando os documentos o pedirem. Numa tarefa de atualização não serve: aí pergunta-se com update_set_status (waiting).',
      inputSchema: {
        type: 'object',
        properties: {
          task: TASK,
          question: {
            type: 'string',
            description: 'A pergunta, clara e curta, com o que precisas.',
          },
        },
        required: ['task', 'question'],
      },
      handler: async (input: { task: string; question: string }) => {
        const found = await findTask(input.task);
        if (typeof found === 'string') return found;
        try {
          const result = await board.askUser(
            userId,
            found.id,
            input.question,
            agentKey,
          );
          return `Pergunta feita em ${result.key}: fica à espera dele, com "Responder: …" em Tarefas.`;
        } catch (error) {
          return failure(error);
        }
      },
    },
  ];
}
