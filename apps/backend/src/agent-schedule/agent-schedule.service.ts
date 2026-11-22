import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppUpdateService } from 'src/app-update/app-update.service';
import { UpdateWithAccount } from 'src/app-update/app-update.types';
import {
  AgentSchedule,
  AgentScheduleRepeat,
  AgentScheduleRunStatus,
  AppUpdateStatus,
  DocLinkType,
  Prisma,
} from 'src/generated/prisma/client/client';
import {
  describeWhen,
  lisbonLabel,
  nextRunAt,
  parseTime,
} from './helpers/nextRunAt';

/** Ficam as últimas execuções de cada agendamento. */
const RUNS_KEPT = 20;
/** Uma execução que não acaba numa hora já não está a correr (o backend reiniciou). */
const RUN_LIMIT_MS = 60 * 60 * 1000;
const TITLE_MAX = 120;
const INSTRUCTION_MAX = 4000;
const TAGS_MAX = 8;
const TAG_MAX = 30;
/** A etiqueta dos "rever mais tarde" das atualizações. */
const UPDATE_TAG = 'atualizações';
/** O aviso de quem tem atualizações disponíveis e nenhum agendamento que trate delas. */
export const UNHANDLED_SUBJECT = 'updates-unhandled';

/** Minúsculas, sem repetidas, no máximo 8. */
export const cleanScheduleTags = (tags: string[]) =>
  [
    ...new Set(
      tags
        .map((tag) =>
          tag.trim().replace(/^#/, '').toLowerCase().slice(0, TAG_MAX),
        )
        .filter(Boolean),
    ),
  ].slice(0, TAGS_MAX);

export interface ScheduleInput {
  agentKey?: string;
  title?: string;
  instruction?: string;
  repeat?: AgentScheduleRepeat;
  runAt?: Date | null;
  time?: string | null;
  weekday?: number | null;
  monthDay?: number | null;
  enabled?: boolean;
  notify?: boolean;
  toChat?: boolean;
  tags?: string[];
  linkType?: DocLinkType | null;
  targetId?: string | null;
  targetLabel?: string | null;
}

export type ScheduleWithRuns = Prisma.AgentScheduleGetPayload<{
  include: { runs: true };
}>;

const withRuns = {
  runs: { orderBy: { startedAt: 'desc' as const }, take: 5 },
};

const withAllRuns = {
  runs: { orderBy: { startedAt: 'desc' as const }, take: RUNS_KEPT },
};

@Injectable()
export class AgentScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly updates: AppUpdateService,
  ) {}

  list(
    userId: string,
    filter: { linkType?: DocLinkType; targetId?: string } = {},
  ): Promise<ScheduleWithRuns[]> {
    return this.prisma.agentSchedule.findMany({
      where: {
        userId,
        ...(filter.linkType ? { linkType: filter.linkType } : {}),
        ...(filter.targetId ? { targetId: filter.targetId } : {}),
      },
      include: withRuns,
      orderBy: [
        { enabled: 'desc' },
        { nextRunAt: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async get(userId: string, id: string): Promise<ScheduleWithRuns> {
    const schedule = await this.prisma.agentSchedule.findFirst({
      where: { id, userId },
      include: withAllRuns,
    });
    if (!schedule)
      throw new NotFoundException('Este agendamento já não existe.');
    return schedule;
  }

  /** Para os agentes: o id, ou o título (se só houver um). */
  async findForAgent(
    userId: string,
    ref: string,
  ): Promise<ScheduleWithRuns | string> {
    const byId = await this.prisma.agentSchedule.findFirst({
      where: { id: ref, userId },
      include: withRuns,
    });
    if (byId) return byId;
    const matches = await this.prisma.agentSchedule.findMany({
      where: { userId, title: { contains: ref.trim(), mode: 'insensitive' } },
      include: withRuns,
      take: 5,
    });
    if (matches.length === 1) return matches[0];
    if (!matches.length)
      return `Não há nenhum agendamento "${ref}". Vê-os com schedule_list.`;
    return `"${ref}" pode ser: ${matches.map((item) => `"${item.title}" (${item.id})`).join(', ')}. Usa o id.`;
  }

  async create(
    userId: string,
    input: ScheduleInput,
    createdBy = 'user',
  ): Promise<ScheduleWithRuns> {
    const data = await this.validate(userId, input, null);
    return this.prisma.agentSchedule.create({
      data: {
        userId,
        agentKey: data.agentKey,
        title: data.title,
        instruction: data.instruction,
        repeat: data.repeat,
        runAt: data.runAt,
        time: data.time,
        weekday: data.weekday,
        monthDay: data.monthDay,
        enabled: data.enabled,
        notify: data.notify,
        toChat: data.toChat,
        tags: data.tags,
        nextRunAt: data.enabled ? nextRunAt(data, new Date()) : null,
        createdBy,
        linkType: data.linkType,
        targetId: data.targetId,
        targetLabel: data.targetLabel,
      },
      include: withRuns,
    });
  }

  /** `changedBy`: o agente que o muda (fica como autor: o pedido passa a dizer quem foi). */
  async update(
    userId: string,
    id: string,
    input: ScheduleInput,
    changedBy?: string,
  ): Promise<ScheduleWithRuns> {
    const current = await this.get(userId, id);
    if (current.updateId) {
      // O "rever mais tarde" de uma atualização: a data, o ligado/desligado, o texto e
      // as etiquetas (o resto vem da atualização).
      const runAt = input.runAt === undefined ? current.runAt : input.runAt;
      const enabled = input.enabled ?? current.enabled;
      if (!runAt)
        throw new BadRequestException('Falta a data para voltar a ver.');
      await this.updates.setRecheckDate(
        userId,
        current.updateId,
        enabled ? runAt : null,
      );
      const instruction = input.instruction?.trim();
      if (
        instruction !== undefined &&
        (!instruction || instruction.length > INSTRUCTION_MAX)
      ) {
        throw new BadRequestException(
          `Diz o que o agente tem de fazer (até ${INSTRUCTION_MAX} caracteres).`,
        );
      }
      return this.prisma.agentSchedule.update({
        where: { id },
        data: {
          runAt,
          enabled,
          notify: input.notify ?? current.notify,
          instruction: instruction ?? current.instruction,
          tags: input.tags ? cleanScheduleTags(input.tags) : current.tags,
          nextRunAt: enabled ? runAt : null,
          ...(changedBy ? { createdBy: changedBy } : {}),
        },
        include: withAllRuns,
      });
    }
    const data = await this.validate(userId, input, current);
    return this.prisma.agentSchedule.update({
      where: { id },
      data: {
        agentKey: data.agentKey,
        title: data.title,
        instruction: data.instruction,
        repeat: data.repeat,
        runAt: data.runAt,
        time: data.time,
        weekday: data.weekday,
        monthDay: data.monthDay,
        enabled: data.enabled,
        notify: data.notify,
        toChat: data.toChat,
        tags: data.tags,
        nextRunAt: data.enabled ? nextRunAt(data, new Date()) : null,
        linkType: data.linkType,
        targetId: data.targetId,
        targetLabel: data.targetLabel,
        ...(changedBy ? { createdBy: changedBy } : {}),
      },
      include: withAllRuns,
    });
  }

  /** As etiquetas já usadas, para os agentes reaproveitarem. */
  async tags(userId: string): Promise<string[]> {
    const rows = await this.prisma.agentSchedule.findMany({
      where: { userId },
      select: { tags: true },
    });
    return [...new Set(rows.flatMap((row) => row.tags))].sort();
  }

  async remove(userId: string, id: string): Promise<void> {
    const current = await this.get(userId, id);
    if (current.updateId && current.enabled) {
      await this.updates.setRecheckDate(userId, current.updateId, null);
    }
    await this.prisma.agentSchedule.delete({ where: { id } });
  }

  // ── Quem corre ──────────────────────────────────────────────────────────

  /** Os que já deviam ter corrido e não estão a correr. */
  async due(limit = 10) {
    const now = new Date();
    return this.prisma.agentSchedule.findMany({
      where: {
        enabled: true,
        nextRunAt: { lte: now },
        runs: {
          none: {
            status: AgentScheduleRunStatus.RUNNING,
            startedAt: { gt: new Date(now.getTime() - RUN_LIMIT_MS) },
          },
        },
      },
      orderBy: { nextRunAt: 'asc' },
      take: limit,
    });
  }

  /**
   * Marca a próxima vez antes de correr, para não correr duas vezes. Se o backend
   * esteve desligado, corre uma só vez e segue para a próxima a partir de agora.
   */
  async claim(schedule: AgentSchedule) {
    const once = schedule.repeat === AgentScheduleRepeat.ONCE;
    await this.prisma.agentSchedule.update({
      where: { id: schedule.id },
      data: once
        ? { enabled: false, nextRunAt: null }
        : { nextRunAt: nextRunAt(schedule, new Date()) },
    });
    return this.prisma.agentScheduleRun.create({
      data: { scheduleId: schedule.id },
    });
  }

  /** "Correr agora": uma execução sem mexer na próxima vez marcada. */
  startRun(scheduleId: string) {
    return this.prisma.agentScheduleRun.create({ data: { scheduleId } });
  }

  async finishRun(
    runId: string,
    result: {
      ok: boolean;
      summary: string;
      notice: string | null;
      tokensIn?: number;
      tokensOut?: number;
      docsUsed?: { id: string; title: string }[];
    },
  ) {
    const run = await this.prisma.agentScheduleRun.update({
      where: { id: runId },
      data: {
        status: result.ok
          ? AgentScheduleRunStatus.DONE
          : AgentScheduleRunStatus.FAILED,
        summary: result.summary.slice(0, 20_000),
        notice: result.notice?.slice(0, 2000) ?? null,
        tokensIn: result.tokensIn ?? 0,
        tokensOut: result.tokensOut ?? 0,
        docsUsed: result.docsUsed,
        finishedAt: new Date(),
      },
    });
    const old = await this.prisma.agentScheduleRun.findMany({
      where: { scheduleId: run.scheduleId },
      orderBy: { startedAt: 'desc' },
      skip: RUNS_KEPT,
      select: { id: true },
    });
    if (old.length) {
      await this.prisma.agentScheduleRun.deleteMany({
        where: { id: { in: old.map((item) => item.id) } },
      });
    }
    return run;
  }

  /** Um reinício corta o que estava a correr: fica como falhado, com o porquê. */
  async failInterrupted(): Promise<void> {
    await this.prisma.agentScheduleRun.updateMany({
      where: { status: AgentScheduleRunStatus.RUNNING },
      data: {
        status: AgentScheduleRunStatus.FAILED,
        summary: 'Interrompido: o MyHomeLab reiniciou enquanto corria.',
        finishedAt: new Date(),
      },
    });
  }

  /**
   * Cada atualização em "Rever mais tarde" com data tem o seu agendamento (o mesmo,
   * reaproveitado se voltar a esperar). Os que já não fazem sentido saem, menos os que
   * já correram (ficam como histórico).
   */
  async reconcileUpdates(): Promise<void> {
    const later = await this.updates.laterWithDate();
    const ids = later.map((update) => update.id);
    await this.prisma.agentSchedule.deleteMany({
      where: {
        updateId: { not: null, notIn: ids },
        enabled: true,
        // Os estudos marcados (Espera por estudo, Study) ficam.
        update: {
          status: {
            notIn: [AppUpdateStatus.STUDY, AppUpdateStatus.STUDYING],
          },
        },
      },
    });
    if (!later.length) return;
    const existing = await this.prisma.agentSchedule.findMany({
      where: { updateId: { in: ids } },
    });
    const byUpdate = new Map(existing.map((item) => [item.updateId, item]));
    for (const update of later) {
      const schedule = byUpdate.get(update.id);
      if (
        schedule?.enabled &&
        schedule.runAt?.getTime() === update.recheckAt.getTime()
      ) {
        continue;
      }
      const data = {
        title: `Rever ${update.label}`,
        repeat: AgentScheduleRepeat.ONCE,
        runAt: update.recheckAt,
        nextRunAt: update.recheckAt,
        enabled: true,
        linkType: update.link.type,
        targetId: update.link.targetId,
        targetLabel: update.label,
      };
      if (schedule) {
        // O texto e as etiquetas ficam como ele os deixou.
        await this.prisma.agentSchedule.update({
          where: { id: schedule.id },
          data,
        });
        continue;
      }
      const agent = await this.prisma.agent.findFirst({
        where: {
          userId: update.userId,
          isActive: true,
          tools: { has: 'update_save_study' },
        },
        select: { key: true },
      });
      await this.prisma.agentSchedule.create({
        data: {
          ...data,
          instruction: `Voltar a estudar a atualização ${update.label} e ver se já é seguro atualizar (estava em "Recheck later").`,
          tags: [UPDATE_TAG],
          userId: update.userId,
          agentKey: agent?.key ?? 'infra',
          createdBy: agent?.key ?? 'infra',
          updateId: update.id,
        },
      });
    }
  }

  /**
   * Uma atualização em Espera por estudo: o agendamento dela corre já ("Estudar …",
   * nos Disparos). É o mesmo agendamento do "rever mais tarde", reaproveitado.
   */
  async scheduleStudy(update: {
    id: string;
    userId: string;
    /** O alvo: a app (APP) ou o servidor, numa atualização do host (SERVER). */
    link: { type: DocLinkType; targetId: string };
    label: string;
  }): Promise<void> {
    const existing = await this.prisma.agentSchedule.findUnique({
      where: { updateId: update.id },
      include: { runs: { where: { status: AgentScheduleRunStatus.RUNNING } } },
    });
    if (
      existing?.enabled &&
      existing.title.startsWith('Estudar') &&
      (existing.runs.length ||
        (existing.nextRunAt && existing.nextRunAt <= new Date()))
    ) {
      return;
    }
    const agent = await this.prisma.agent.findFirst({
      where: {
        userId: update.userId,
        isActive: true,
        tools: { has: 'update_save_study' },
      },
      select: { key: true },
    });
    const now = new Date();
    const data = {
      title: `Estudar ${update.label}`,
      instruction: `Estudar a atualização ${update.label} (está em Espera por estudo) e gravar o estudo.`,
      repeat: AgentScheduleRepeat.ONCE,
      runAt: now,
      nextRunAt: now,
      enabled: true,
      notify: false,
      linkType: update.link.type,
      targetId: update.link.targetId,
      targetLabel: update.label,
    };
    if (existing) {
      await this.prisma.agentSchedule.update({
        where: { id: existing.id },
        data,
      });
      return;
    }
    await this.prisma.agentSchedule.create({
      data: {
        ...data,
        userId: update.userId,
        agentKey: agent?.key ?? 'infra',
        createdBy: 'MyHomeLab',
        updateId: update.id,
        tags: ['atualizações'],
      },
    });
  }

  // ── Quando aparece uma atualização nova ─────────────────────────────────

  /**
   * As atualizações disponíveis ainda por anunciar, com os agendamentos "quando
   * aparece" ligados do dono. Ficam logo anunciadas (corre uma vez por versão); as de
   * quem não tem nenhum agendamento destes ficam por anunciar.
   */
  async takeNewUpdates(): Promise<
    { schedule: ScheduleWithRuns; updates: UpdateWithAccount[] }[]
  > {
    const fresh = await this.updates.unannounced();
    if (!fresh.length) return [];
    const schedules = await this.prisma.agentSchedule.findMany({
      where: {
        enabled: true,
        repeat: AgentScheduleRepeat.ON_NEW_UPDATE,
        userId: { in: [...new Set(fresh.map((update) => update.userId))] },
      },
      include: withRuns,
    });
    const owners = new Set(schedules.map((schedule) => schedule.userId));
    await this.updates.markAnnounced(
      fresh.filter((update) => owners.has(update.userId)).map(({ id }) => id),
    );
    return schedules.map((schedule) => ({
      schedule,
      updates: fresh.filter((update) => update.userId === schedule.userId),
    }));
  }

  /**
   * Quem tem atualizações disponíveis há mais de uma hora e nenhum agendamento que
   * trate delas (um "quando aparece", ou um que se repete com a etiqueta atualizações).
   */
  async unhandledUpdates(): Promise<{ userId: string; count: number }[]> {
    const available = await this.updates.available();
    // Também quem tem o aviso aberto, para ele se fechar quando já não há nada.
    const warned = await this.prisma.notification.findMany({
      where: { subject: UNHANDLED_SUBJECT, resolvedAt: null },
      select: { userId: true },
    });
    const users = [
      ...new Set([
        ...available.map((update) => update.userId),
        ...warned.map((notice) => notice.userId),
      ]),
    ];
    const handling = await this.prisma.agentSchedule.findMany({
      where: {
        userId: { in: users },
        enabled: true,
        updateId: null,
        OR: [
          { repeat: AgentScheduleRepeat.ON_NEW_UPDATE },
          {
            repeat: { not: AgentScheduleRepeat.ONCE },
            tags: { has: UPDATE_TAG },
          },
        ],
      },
      select: { userId: true },
    });
    const handled = new Set(handling.map((schedule) => schedule.userId));
    const hourAgo = Date.now() - 60 * 60 * 1000;
    return users.map((userId) => ({
      userId,
      count: handled.has(userId)
        ? 0
        : available.filter(
            (update) =>
              update.userId === userId && update.createdAt.getTime() < hourAgo,
          ).length,
    }));
  }

  // ── Interno ─────────────────────────────────────────────────────────────

  private async validate(
    userId: string,
    input: ScheduleInput,
    current: AgentSchedule | null,
  ) {
    const pick = <K extends keyof ScheduleInput>(
      key: K,
      fallback: ScheduleInput[K],
    ) => (input[key] === undefined ? fallback : input[key]);
    const agentKey = String(pick('agentKey', current?.agentKey) ?? '').trim();
    const title = String(pick('title', current?.title) ?? '').trim();
    const instruction = String(
      pick('instruction', current?.instruction) ?? '',
    ).trim();
    const repeat = pick('repeat', current?.repeat ?? AgentScheduleRepeat.ONCE)!;
    const enabled = pick('enabled', current?.enabled ?? true)!;
    const notify = pick('notify', current?.notify ?? true)!;
    const toChat = pick('toChat', current?.toChat ?? false)!;
    const tags = cleanScheduleTags(pick('tags', current?.tags ?? []) ?? []);

    if (!title || title.length > TITLE_MAX) {
      throw new BadRequestException(
        `O título é obrigatório (até ${TITLE_MAX} caracteres).`,
      );
    }
    if (!instruction || instruction.length > INSTRUCTION_MAX) {
      throw new BadRequestException(
        `Diz o que o agente tem de fazer (até ${INSTRUCTION_MAX} caracteres).`,
      );
    }
    if (!Object.values(AgentScheduleRepeat).includes(repeat)) {
      throw new BadRequestException('Repetição desconhecida.');
    }
    const agent = await this.prisma.agent.findFirst({
      where: { userId, key: agentKey },
      select: { key: true },
    });
    if (!agent)
      throw new BadRequestException(
        `Não há nenhum agente "${agentKey}" na equipa.`,
      );

    const once = repeat === AgentScheduleRepeat.ONCE;
    const onNewUpdate = repeat === AgentScheduleRepeat.ON_NEW_UPDATE;
    const runAt = once ? (pick('runAt', current?.runAt ?? null) ?? null) : null;
    const time =
      once || onNewUpdate
        ? null
        : (pick('time', current?.time ?? null) ?? null);
    const weekday =
      repeat === AgentScheduleRepeat.WEEKLY
        ? (pick('weekday', current?.weekday ?? null) ?? null)
        : null;
    const monthDay =
      repeat === AgentScheduleRepeat.MONTHLY
        ? (pick('monthDay', current?.monthDay ?? null) ?? null)
        : null;

    if (once) {
      if (!runAt || Number.isNaN(runAt.getTime())) {
        throw new BadRequestException('Diz quando corre (data e hora).');
      }
      const changed = !current || current.runAt?.getTime() !== runAt.getTime();
      if (enabled && changed && runAt.getTime() < Date.now() - 60_000) {
        throw new BadRequestException(
          `Essa hora já passou (${lisbonLabel(runAt)}).`,
        );
      }
    } else if (!onNewUpdate && !parseTime(time)) {
      throw new BadRequestException('A hora tem de ser HH:mm (ex.: 05:00).');
    }
    if (
      repeat === AgentScheduleRepeat.WEEKLY &&
      !(Number.isInteger(weekday) && weekday! >= 1 && weekday! <= 7)
    ) {
      throw new BadRequestException(
        'Diz o dia da semana (1 = segunda … 7 = domingo).',
      );
    }
    if (
      repeat === AgentScheduleRepeat.MONTHLY &&
      !(Number.isInteger(monthDay) && monthDay! >= 1 && monthDay! <= 31)
    ) {
      throw new BadRequestException('Diz o dia do mês (1 a 31).');
    }

    const linkType = pick('linkType', current?.linkType ?? null) ?? null;
    const targetId = linkType
      ? (pick('targetId', current?.targetId ?? null) ?? null)
      : null;
    if (linkType && !Object.values(DocLinkType).includes(linkType)) {
      throw new BadRequestException('Ligação desconhecida.');
    }
    if (linkType && !targetId)
      throw new BadRequestException('Falta a que está ligado.');

    return {
      agentKey: agent.key,
      title,
      instruction,
      repeat,
      runAt,
      time,
      weekday,
      monthDay,
      enabled,
      notify,
      toChat,
      tags,
      linkType,
      targetId,
      targetLabel: linkType
        ? (pick('targetLabel', current?.targetLabel ?? null) ?? null)
        : null,
    };
  }
}

/** Uma linha por agendamento, para os agentes. */
export function scheduleLine(schedule: ScheduleWithRuns): string {
  const last = schedule.runs[0];
  return [
    `- "${schedule.title}" (${schedule.id}) — ${schedule.agentKey}, ${describeWhen(schedule)}`,
    schedule.enabled
      ? schedule.nextRunAt
        ? `próxima ${lisbonLabel(schedule.nextRunAt)}`
        : 'sem próxima'
      : 'desligado',
    last
      ? `última ${lisbonLabel(last.startedAt)} (${last.status === 'DONE' ? 'ok' : last.status === 'FAILED' ? 'falhou' : 'a correr'})`
      : 'ainda não correu',
    schedule.createdBy === 'user'
      ? 'criado por ele'
      : `criado por ${schedule.createdBy}`,
    schedule.updateId ? 'rever atualização' : null,
    schedule.tags.length ? `#${schedule.tags.join(' #')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
