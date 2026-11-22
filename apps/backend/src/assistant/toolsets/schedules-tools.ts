import { AgentTool } from '../claude-agent.client';
import { withinReach } from 'src/agent/helpers/teamReach';
import { AgentContext } from '../agents/agent-context';
import {
  AgentScheduleRepeat,
  DocLinkType,
} from 'src/generated/prisma/client/client';
import {
  ScheduleInput,
  scheduleLine,
} from 'src/agent-schedule/agent-schedule.service';
import {
  describeWhen,
  lisbonLabel,
  lisbonToDate,
} from 'src/agent-schedule/helpers/nextRunAt';

const SCHEDULE = {
  type: 'string' as const,
  description: 'O agendamento: o id (de schedule_list) ou o título.',
};

const FIELDS = {
  agent: {
    type: 'string' as const,
    description:
      'A chave do agente que corre (ex.: "infra"); por omissão és tu.',
  },
  title: {
    type: 'string' as const,
    description: 'Curto, diz o que é (ex.: "Atualizações prontas às 5h").',
  },
  instruction: {
    type: 'string' as const,
    description:
      'O que o agente tem de fazer quando corre, como se lho pedisses agora: o objetivo, onde ver e o que fazer com o que encontrar.',
  },
  repeat: {
    type: 'string' as const,
    enum: Object.values(AgentScheduleRepeat),
    description:
      'ONCE (uma vez, em run_at), DAILY, WEEKLY (weekday) ou MONTHLY (month_day), à hora time; ou ON_NEW_UPDATE (sem hora): corre sempre que aparece uma atualização nova de uma app ou do servidor, com elas no pedido (para "sempre que surgir um update, trata dele").',
  },
  run_at: {
    type: 'string' as const,
    description:
      'ONCE: quando, em hora de Lisboa "AAAA-MM-DD HH:mm" (ou ISO com fuso).',
  },
  time: {
    type: 'string' as const,
    description: 'Repetidos: "HH:mm", hora de Lisboa.',
  },
  weekday: {
    type: 'integer' as const,
    description: 'WEEKLY: 1 = segunda … 7 = domingo.',
  },
  month_day: { type: 'integer' as const, description: 'MONTHLY: 1 a 31.' },
  notify: {
    type: 'boolean' as const,
    description: 'Avisá-lo quando houver algo a dizer (por omissão sim).',
  },
  to_chat: {
    type: 'boolean' as const,
    description:
      'A resposta de cada vez fica numa conversa nova do Jarvis, com aviso (ex.: "um resumo do email todos os dias às 7h"). Por omissão não.',
  },
  enabled: { type: 'boolean' as const },
  tags: {
    type: 'array' as const,
    items: { type: 'string' as const },
    description:
      'Etiquetas curtas, em minúsculas, para ele filtrar (ex.: "atualizações", "backups", "email"). Usa as que já há (schedule_list mostra-as) antes de inventar outras. No update, a lista substitui a anterior.',
  },
  link: {
    type: 'object' as const,
    description:
      'A que fica ligado (aparece na página disso). type: APP (id da app ligada), SERVER (id do servidor), GUEST, MONITOR, AGENT, DOC.',
    properties: {
      type: { type: 'string' as const, enum: Object.values(DocLinkType) },
      targetId: { type: 'string' as const },
      label: { type: 'string' as const },
    },
    required: ['type', 'targetId', 'label'],
  },
};

interface ToolInput {
  schedule?: string;
  agent?: string;
  title?: string;
  instruction?: string;
  repeat?: AgentScheduleRepeat;
  run_at?: string;
  time?: string;
  weekday?: number;
  month_day?: number;
  notify?: boolean;
  to_chat?: boolean;
  enabled?: boolean;
  tags?: string[];
  link?: { type: DocLinkType; targetId: string; label: string };
}

/** "2026-11-15 09:00" é hora de Lisboa; um ISO com fuso vale como está. */
const parseRunAt = (value: string): Date | string => {
  const local = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(
    value.trim(),
  );
  if (local) {
    const [, year, month, day, hour, minute] = local.map(Number);
    return lisbonToDate(year, month, day, hour, minute);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? `Não percebi a data "${value}". Usa "AAAA-MM-DD HH:mm" (hora de Lisboa).`
    : date;
};

const toInput = (input: ToolInput): ScheduleInput | string => {
  const runAt = input.run_at ? parseRunAt(input.run_at) : undefined;
  if (typeof runAt === 'string') return runAt;
  return {
    agentKey: input.agent,
    title: input.title,
    instruction: input.instruction,
    repeat: input.repeat,
    runAt,
    time: input.time,
    weekday: input.weekday,
    monthDay: input.month_day,
    notify: input.notify,
    toChat: input.to_chat,
    enabled: input.enabled,
    tags: input.tags,
    ...(input.link
      ? {
          linkType: input.link.type,
          targetId: input.link.targetId,
          targetLabel: input.link.label,
        }
      : {}),
  };
};

const failure = (error: unknown) =>
  `Não deu: ${error instanceof Error ? error.message : String(error)}`;

export function buildSchedulesTools(context: AgentContext): AgentTool[] {
  const agentKey = context.agentKey ?? 'ceo';
  const reachBlock = (target?: string) =>
    !target || withinReach(context.team, agentKey, target)
      ? null
      : `Recusado: só agendas trabalho para ti e para quem te responde (não para "${target}").`;
  // Os disparos dele só se mudam com ele presente (no chat); os de outro agente, só
  // os de quem está abaixo de quem pede.
  const changeBlock = (schedule: { createdBy: string; agentKey: string }) => {
    if (schedule.createdBy === 'user' && context.source !== 'chat') {
      return 'Recusado: este agendamento foi criado por ele e só muda com ele no chat. Propõe-lhe a mudança no aviso.';
    }
    return reachBlock(schedule.agentKey);
  };

  return [
    {
      name: 'schedule_list',
      description:
        'Os trabalhos agendados dos agentes (página Agendamentos): o que fazem, quando correm, a última vez e quem os criou.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const schedules = await context.schedules.list(context.userId);
        if (!schedules.length) return 'Ainda não há agendamentos.';
        const tags = await context.schedules.tags(context.userId);
        return [
          ...schedules.map(scheduleLine),
          tags.length ? `\nEtiquetas em uso: ${tags.join(', ')}` : '',
        ]
          .join('\n')
          .trim();
      },
    },
    {
      name: 'schedule_create',
      description:
        'Agenda um trabalho para um agente fazer sozinho numa data ou repetido ("revê isto no dia 15", "todos os dias às 5h vê…"). Quando corre, ninguém está a acompanhar: a instrução tem de chegar sozinha. Ele vê e muda tudo em Agendamentos. Cria só quando ele pedir ou quando os documentos o disserem. Se é sobre uma app, um servidor ou um projeto, liga-o (link) para aparecer na página disso.',
      inputSchema: {
        type: 'object',
        properties: FIELDS,
        required: ['title', 'instruction', 'repeat'],
      },
      handler: async (input: ToolInput) => {
        const data = toInput({ agent: agentKey, ...input });
        if (typeof data === 'string') return data;
        const outOfReach = reachBlock(data.agentKey);
        if (outOfReach) return outOfReach;
        try {
          const schedule = await context.schedules.create(
            context.userId,
            data,
            agentKey,
          );
          return `Agendado: "${schedule.title}" (${schedule.id}), ${describeWhen(schedule)}${schedule.nextRunAt ? `; a primeira vez a ${lisbonLabel(schedule.nextRunAt)}` : ''}. Ele vê-o em Agendamentos.`;
        } catch (error) {
          return failure(error);
        }
      },
    },
    {
      name: 'schedule_update',
      description:
        'Muda um agendamento (o que faz, quando, etiquetas, ligar ou desligar). Só o que mandares muda.',
      inputSchema: {
        type: 'object',
        properties: { schedule: SCHEDULE, ...FIELDS },
        required: ['schedule'],
      },
      handler: async (input: ToolInput) => {
        const found = await context.schedules.findForAgent(
          context.userId,
          input.schedule ?? '',
        );
        if (typeof found === 'string') return found;
        const blocked = changeBlock(found);
        if (blocked) return blocked;
        const data = toInput(input);
        if (typeof data === 'string') return data;
        const outOfReach = data.agentKey ? reachBlock(data.agentKey) : null;
        if (outOfReach) return outOfReach;
        try {
          const schedule = await context.schedules.update(
            context.userId,
            found.id,
            data,
            agentKey,
          );
          return `Mudado: ${scheduleLine(schedule)}`;
        } catch (error) {
          return failure(error);
        }
      },
    },
    {
      name: 'schedule_delete',
      description: 'Apaga um agendamento (e o histórico das vezes que correu).',
      inputSchema: {
        type: 'object',
        properties: { schedule: SCHEDULE },
        required: ['schedule'],
      },
      handler: async (input: { schedule: string }) => {
        const found = await context.schedules.findForAgent(
          context.userId,
          input.schedule,
        );
        if (typeof found === 'string') return found;
        const blocked = changeBlock(found);
        if (blocked) return blocked;
        await context.schedules.remove(context.userId, found.id);
        return `Apagado o agendamento "${found.title}".`;
      },
    },
  ];
}
