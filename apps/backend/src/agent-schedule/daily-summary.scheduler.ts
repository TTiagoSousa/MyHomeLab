import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from 'src/notification/notification.service';
import { NotificationKind } from 'src/generated/prisma/client/client';
import { estimateCost } from 'src/ai-credential/ai-usage.service';
import { targetLabel } from 'src/app-update/helpers/updateFields';
import { classifyCommand } from 'src/server-connection/helpers/commandSafety';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const lisbonDay = (date = new Date()) =>
  date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Lisbon' });

/** A meia-noite de Lisboa de um dia AAAA-MM-DD (UTC+0 no inverno, UTC+1 no verão). */
export const lisbonDayStart = (day: string) => {
  const utcMidnight = new Date(`${day}T00:00:00Z`);
  const offset = Number(
    utcMidnight.toLocaleString('en-GB', {
      timeZone: 'Europe/Lisbon',
      hour: '2-digit',
      hourCycle: 'h23',
    }),
  );
  return new Date(utcMidnight.getTime() - offset * HOUR_MS);
};

interface SummaryRange {
  since: Date;
  until: Date;
  fromDay: string;
  toDay: string;
  costLabel: string;
}

/**
 * Às 21h: o que os agentes mudaram sozinhos nesse dia (comandos que alteraram,
 * atualizações, tarefas, disparos e o que a IA custou), numa notificação. Sem
 * nada que contar, não há notificação. O mesmo resumo pode pedir-se para outros
 * dias (between), sem notificar.
 */
@Injectable()
export class DailySummaryScheduler {
  private readonly logger = new Logger(DailySummaryScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  @Cron('0 0 21 * * *', {
    timeZone: 'Europe/Lisbon',
    name: 'Resumo diário dos agentes',
  })
  async run(): Promise<void> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    for (const { id } of users) {
      await this.summarize(id).catch((error: unknown) =>
        this.logger.warn(
          `Resumo do dia (${id}): ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  async summarize(userId: string, now = new Date()): Promise<string | null> {
    const message = await this.describe(userId, {
      since: new Date(now.getTime() - DAY_MS),
      until: now,
      fromDay: lisbonDay(now),
      toDay: lisbonDay(now),
      costLabel: 'hoje',
    });
    if (!message) return null;
    const subject = `daily-summary:${lisbonDay(now)}`;
    // Só fica o resumo de hoje: o de ontem já não faz falta.
    await this.notifications.resolveUserSubjectsExcept(
      userId,
      'daily-summary:',
      subject,
      NotificationKind.AGENT_NOTICE,
    );
    await this.notifications.openUserSubject({
      userId,
      subject,
      kind: NotificationKind.AGENT_NOTICE,
      title: 'O que os agentes fizeram hoje',
      message,
    });
    return message;
  }

  /** O que os agentes fizeram entre dois dias (AAAA-MM-DD, hora de Lisboa, os dois incluídos). */
  async between(userId: string, fromDay: string, toDay: string) {
    const [from, to] = fromDay <= toDay ? [fromDay, toDay] : [toDay, fromDay];
    const message = await this.describe(userId, {
      since: lisbonDayStart(from),
      until: lisbonDayStart(
        new Date(new Date(`${to}T12:00:00Z`).getTime() + DAY_MS)
          .toISOString()
          .slice(0, 10),
      ),
      fromDay: from,
      toDay: to,
      costLabel: from === to ? 'nesse dia' : 'no período',
    });
    return { from, to, message };
  }

  private async describe(
    userId: string,
    range: SummaryRange,
  ): Promise<string | null> {
    const when = { gte: range.since, lt: range.until };
    const [logged, updates, activity, runs, usage] = await Promise.all([
      this.prisma.serverCommand.findMany({
        where: { userId, autoApproved: false, updateId: null, createdAt: when },
        include: { serverConnection: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.appUpdate.findMany({
        where: {
          userId,
          OR: [{ startedAt: when }, { finishedAt: when }],
        },
        include: {
          account: { select: { displayName: true, provider: true } },
          hostServer: { select: { name: true } },
        },
      }),
      this.prisma.boardTaskActivity.count({
        where: {
          createdAt: when,
          actor: { notIn: ['user', 'MyHomeLab'] },
          task: { userId },
        },
      }),
      this.prisma.agentScheduleRun.findMany({
        where: { startedAt: when, schedule: { userId } },
        select: { status: true },
      }),
      this.prisma.aiUsage.findMany({
        where: { userId, day: { gte: range.fromDay, lte: range.toDay } },
      }),
    ]);
    // Os registos antigos marcavam como alteração comandos que só leem: volta-se a ver cada um.
    const commands = logged.filter(
      (row) => classifyCommand(row.command) === 'write',
    );
    const failed = runs.filter((run) => run.status === 'FAILED').length;
    const cost = usage.reduce(
      (sum, row) => sum + estimateCost(row.model, row),
      0,
    );
    if (!commands.length && !updates.length && !activity && !runs.length)
      return null;

    return [
      commands.length
        ? `Comandos que alteraram (${commands.length}):\n${commands
            .slice(0, 8)
            .map(
              (row) =>
                `- ${row.serverConnection.name}: ${row.command.slice(0, 120)}${row.status === 'FAILED' ? ' (falhou)' : ''}`,
            )
            .join(
              '\n',
            )}${commands.length > 8 ? `\n- … e mais ${commands.length - 8}` : ''}`
        : null,
      updates.length
        ? `Atualizações: ${updates
            .map(
              (update) =>
                `${targetLabel(update)} ${update.toVersion} (${update.status})`,
            )
            .join(', ')}.`
        : null,
      activity ? `Mudanças dos agentes nas tarefas: ${activity}.` : null,
      runs.length
        ? `Disparos: ${runs.length}${failed ? `, ${failed} falharam` : ''}.`
        : null,
      cost ? `IA: cerca de ${cost.toFixed(2)} € ${range.costLabel}.` : null,
    ]
      .filter(Boolean)
      .join('\n\n');
  }
}
