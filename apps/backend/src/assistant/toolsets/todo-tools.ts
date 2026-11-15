import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import {
  todoCreate,
  todoCreateList,
  todoDelete,
  todoListTasks,
  todoLists,
  todoUpdate,
} from '../tools/manageTodos';

const TASK_SCHEMA = {
  type: 'string' as const,
  description:
    'O id devolvido por todo_list (ou o título, entre as por fazer).',
};

const LIST_FILTER_SCHEMA = {
  type: 'string' as const,
  description: 'Nome da lista, para escolher entre tarefas com o mesmo título.',
};

/**
 * As Tarefas do utilizador (os afazeres guardados no MyHomeLab, página Tarefas).
 * Não são as do quadro (board_*).
 */
export function buildTodoTools(context: AgentContext): AgentTool[] {
  return [
    {
      name: 'todo_lists',
      description:
        'As listas da página Tarefas (os afazeres do utilizador), com quantas tarefas por fazer tem cada uma.',
      inputSchema: { type: 'object', properties: {} },
      handler: () => todoLists(context),
    },
    {
      name: 'todo_list',
      description:
        'As tarefas da página Tarefas, por prazo, com lista, prioridade, notas e id. Por omissão ' +
        'só as por fazer, de todas as listas. due: overdue (atrasadas), today (até hoje), week ' +
        '(próximos 7 dias) — para "o que tenho para hoje".',
      inputSchema: {
        type: 'object',
        properties: {
          list: {
            type: 'string',
            description: 'Só esta lista (nome ou parte dele).',
          },
          include_done: {
            type: 'boolean',
            description: 'true para incluir as feitas.',
          },
          due: { type: 'string', enum: ['overdue', 'today', 'week'] },
        },
      },
      handler: (input: {
        list?: string;
        include_done?: boolean;
        due?: 'overdue' | 'today' | 'week';
      }) => todoListTasks(context, input),
    },
    {
      name: 'todo_create',
      description:
        'Cria uma tarefa na página Tarefas. A lista cria-se se ainda não existir (ex.: "Servidor"). ' +
        'Para algo que o utilizador tem de fazer ou responder: título curto e acionável ' +
        '("Responder ao Jarvis sobre o Forgejo 17"), o porquê nas notas e, quando há sítio ' +
        'onde se trata, os links (caminhos do site, ex.: /MyHomeLab/Projects/<id>, ou URLs).',
      inputSchema: {
        type: 'object',
        properties: {
          list: { type: 'string', description: 'Nome da lista.' },
          title: { type: 'string', description: 'O título.' },
          notes: {
            type: 'string',
            description: 'Notas: o contexto e o que falta.',
          },
          due_date: {
            type: 'string',
            description: 'Prazo, AAAA-MM-DD (hora de Portugal).',
          },
          due_time: {
            type: 'string',
            description: 'Hora do prazo, HH:MM. Sem hora = o dia todo.',
          },
          priority: { type: 'string', enum: ['alta', 'media', 'baixa'] },
          links: {
            type: 'array',
            items: { type: 'string' },
            description: 'Onde se trata (caminhos do site ou URLs).',
          },
          parent: {
            type: 'string',
            description: 'Id da tarefa-mãe, para uma sub-tarefa.',
          },
        },
        required: ['list', 'title'],
      },
      handler: (input: {
        list: string;
        title: string;
        notes?: string;
        due_date?: string;
        due_time?: string;
        priority?: string;
        links?: string[];
        parent?: string;
      }) => todoCreate(context, input),
    },
    {
      name: 'todo_update',
      description:
        'Muda uma tarefa da página Tarefas: título, notas (ou acrescentar), prazo, prioridade, ' +
        'estado, links ou lista. Quando o assunto avança (ex.: ele respondeu), muda a tarefa para ' +
        'o passo seguinte ou dá-a como feita, com uma nota do que aconteceu.',
      inputSchema: {
        type: 'object',
        properties: {
          task: TASK_SCHEMA,
          list: LIST_FILTER_SCHEMA,
          title: { type: 'string' },
          notes: { type: 'string', description: 'Substitui as notas.' },
          append_notes: { type: 'string', description: 'Acrescenta às notas.' },
          due_date: {
            type: 'string',
            description: 'AAAA-MM-DD; "" tira o prazo.',
          },
          due_time: { type: 'string', description: 'HH:MM (com due_date).' },
          priority: {
            type: 'string',
            enum: ['alta', 'media', 'baixa', 'nenhuma'],
          },
          status: {
            type: 'string',
            enum: ['por_fazer', 'a_andar', 'feita', 'cancelada'],
          },
          move_to: {
            type: 'string',
            description: 'Passa para esta lista (criada se não existir).',
          },
          links: {
            type: 'array',
            items: { type: 'string' },
            description: 'Substitui os links.',
          },
          add_links: {
            type: 'array',
            items: { type: 'string' },
            description: 'Acrescenta estes links aos que já tem.',
          },
        },
        required: ['task'],
      },
      handler: (input: {
        task: string;
        list?: string;
        title?: string;
        notes?: string;
        append_notes?: string;
        due_date?: string;
        due_time?: string;
        priority?: string;
        status?: string;
        move_to?: string;
        links?: string[];
        add_links?: string[];
      }) => todoUpdate(context, input),
    },
    {
      name: 'todo_delete',
      description:
        'Apaga uma tarefa da página Tarefas de vez. Só quando o utilizador pede para apagar (não para "já fiz").',
      inputSchema: {
        type: 'object',
        properties: { task: TASK_SCHEMA, list: LIST_FILTER_SCHEMA },
        required: ['task'],
      },
      handler: (input: { task: string; list?: string }) =>
        todoDelete(context, input),
    },
    {
      name: 'todo_create_list',
      description: 'Cria uma lista nova na página Tarefas.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'O nome da lista.' },
        },
        required: ['name'],
      },
      handler: (input: { name: string }) => todoCreateList(context, input),
    },
  ];
}
