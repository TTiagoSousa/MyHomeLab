import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import { ConnectedAccount } from 'src/generated/prisma/client/client';
import {
  SOLIDTIME_GROUPS,
  SOLIDTIME_OBJECTS,
} from 'src/solidtime/solidtime.client';
import {
  catalog,
  listEntries,
  overview,
  report,
  saveEntry,
  saveObject,
  solidtimeTarget,
  startTimer,
  stopTimer,
} from '../tools/solidtimeTools';

const ACCOUNT = {
  type: 'string' as const,
  description: 'O solidtime (nome ou endereço). Omite quando só há um.',
};

const WHEN = {
  type: 'string' as const,
  description: 'AAAA-MM-DD ou AAAA-MM-DD HH:MM, na hora dele.',
};

const CLEARABLE = {
  type: ['string', 'null'] as ('string' | 'null')[],
  description: 'O nome ou o id; null tira-o.',
};

// As definições são fixas (a cache vive do prefixo igual); o token só entra nos
// handlers, que leem apenas as contas deste utilizador.
export function buildSolidtimeTools(context: AgentContext): AgentTool[] {
  const run =
    <T>(work: (account: ConnectedAccount, input: T) => Promise<string>) =>
    async (input: T & { account?: string }) => {
      const target = await solidtimeTarget(
        context.connectedAccountRepository,
        context.userId,
        input.account,
      );
      return typeof target === 'string' ? target : work(target, input);
    };

  return [
    {
      name: 'solidtime_overview',
      description:
        'Resumo do solidtime (o registo de horas): a organização e o papel dele, o cronómetro a contar, as horas de hoje e da semana e por projeto.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run((account) => overview(account)),
    },
    {
      name: 'solidtime_entries',
      description:
        'Os registos de horas de um período (por omissão, desde o início da semana), com descrição, projeto, tarefa, etiquetas e o id. Só os dele, ou de toda a organização com everyone (se o papel deixar).',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          from: WHEN,
          to: WHEN,
          project: { type: 'string' },
          everyone: { type: 'boolean' },
          limit: { type: 'integer', description: 'Até 500 (por omissão 50).' },
        },
      },
      handler: run(listEntries),
    },
    {
      name: 'solidtime_report',
      description:
        'As horas (e o custo, se houver tarifas) de um período agrupadas: group e sub_group por day, week, month, year, project, client, task, tag, description, billable ou user. Por omissão, a semana por projeto.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          from: WHEN,
          to: WHEN,
          group: { type: 'string', enum: [...SOLIDTIME_GROUPS] },
          sub_group: { type: 'string', enum: [...SOLIDTIME_GROUPS] },
          everyone: { type: 'boolean' },
        },
      },
      handler: run(report),
    },
    {
      name: 'solidtime_catalog',
      description:
        'Os projetos (com cliente, horas gastas e estimadas), os clientes, as tarefas ou as etiquetas, com o id. archived inclui os arquivados.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          kind: { type: 'string', enum: [...SOLIDTIME_OBJECTS] },
          query: { type: 'string' },
          archived: { type: 'boolean' },
        },
        required: ['kind'],
      },
      handler: run(catalog),
    },
    {
      name: 'solidtime_start_timer',
      description:
        'Põe o cronómetro a contar agora (ou desde start), com descrição, projeto, tarefa e etiquetas (nomes ou ids). Se já houver um a contar, não mexe — com stop_running: true para-o primeiro.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          description: { type: 'string' },
          project: { type: 'string' },
          task: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          billable: { type: 'boolean' },
          start: WHEN,
          stop_running: { type: 'boolean' },
        },
      },
      handler: run(startTimer),
    },
    {
      name: 'solidtime_stop_timer',
      description:
        'Para o cronómetro que está a contar (agora, ou à hora end).',
      inputSchema: {
        type: 'object',
        properties: { account: ACCOUNT, end: WHEN },
      },
      handler: run(stopTimer),
    },
    {
      name: 'solidtime_save_entry',
      description:
        'Sem id regista horas já passadas (start e end obrigatórios). Com id (de solidtime_entries) muda o registo: horas, descrição, projeto, tarefa, etiquetas, faturável; só o que passares, e devolve o de antes. Não apaga registos.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          id: { type: 'string' },
          start: WHEN,
          end: WHEN,
          description: { type: ['string', 'null'] },
          project: CLEARABLE,
          task: CLEARABLE,
          tags: { type: 'array', items: { type: 'string' } },
          billable: { type: 'boolean' },
        },
      },
      handler: run(saveEntry),
    },
    {
      name: 'solidtime_save_object',
      description:
        'Sem id cria um projeto, um cliente, uma tarefa (precisa do project) ou uma etiqueta; com id (ou o nome atual) muda-o. Projetos: color (#rrggbb), client, billable, archived, estimated_hours. Clientes: archived. Tarefas: done, estimated_hours. Não apaga.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          kind: { type: 'string', enum: [...SOLIDTIME_OBJECTS] },
          id: { type: 'string' },
          name: { type: 'string' },
          color: { type: 'string' },
          client: CLEARABLE,
          project: { type: 'string' },
          billable: { type: 'boolean' },
          archived: { type: 'boolean' },
          done: { type: 'boolean' },
          estimated_hours: { type: ['number', 'null'] },
        },
        required: ['kind'],
      },
      handler: run(saveObject),
    },
  ];
}
