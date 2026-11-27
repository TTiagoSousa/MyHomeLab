import {
  BadRequestException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AssistantService } from 'src/assistant/assistant.service';
import { NotificationService } from 'src/notification/notification.service';
import {
  AgentSchedule,
  NotificationKind,
} from 'src/generated/prisma/client/client';
import { AgentScheduleService } from './agent-schedule.service';
import { scheduleNotice } from './helpers/scheduleNotice';

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

@Injectable()
export class AgentScheduleRunner implements OnApplicationBootstrap {
  private readonly logger = new Logger(AgentScheduleRunner.name);
  private ticking = false;

  constructor(
    private readonly schedules: AgentScheduleService,
    private readonly assistant: AssistantService,
    private readonly notifications: NotificationService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.schedules
      .failInterrupted()
      .catch((error: unknown) =>
        this.logger.warn(`Execuções interrompidas: ${errorText(error)}`),
      );
  }

  // De minuto a minuto: primeiro os "rever mais tarde" das atualizações, depois o
  // que já devia ter corrido. Cada um corre em segundo plano.
  @Cron('0 * * * * *', { name: 'Disparos' })
  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.schedules
        .reconcileUpdates()
        .catch((error: unknown) =>
          this.logger.warn(`Rever mais tarde: ${errorText(error)}`),
        );
      for (const schedule of await this.schedules.due()) {
        const run = await this.schedules.claim(schedule);
        void this.execute(schedule, run.id);
      }
    } catch (error) {
      this.logger.warn(`Agendamentos: ${errorText(error)}`);
    } finally {
      this.ticking = false;
    }
  }

  async runNow(userId: string, id: string): Promise<void> {
    const schedule = await this.schedules.get(userId, id);
    if (schedule.runs.some((run) => run.status === 'RUNNING')) {
      throw new BadRequestException('Este agendamento já está a correr.');
    }
    const run = await this.schedules.startRun(schedule.id);
    void this.execute(schedule, run.id);
  }

  private async execute(schedule: AgentSchedule, runId: string): Promise<void> {
    try {
      const result = await this.assistant.runScheduled(schedule);
      const notice = schedule.updateId ? null : scheduleNotice(result.reply);
      await this.schedules.finishRun(runId, {
        ok: true,
        summary: result.reply || '(sem resposta)',
        notice,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        docsUsed: result.docsUsed,
      });
      // Correu bem: o "Não correu" de uma vez anterior deixa de valer.
      if (!notice && !(schedule.toChat && schedule.notify)) {
        await this.notifications
          .resolveUserSubject(
            schedule.userId,
            `schedule:${schedule.id}`,
            NotificationKind.AGENT_NOTICE,
          )
          .catch(() => undefined);
      }
      if (schedule.toChat && result.reply.trim()) {
        // A resposta vai para uma conversa nova do Jarvis, e avisa-se que chegou.
        await this.assistant.postScheduledReply(schedule, result.reply);
        if (schedule.notify)
          await this.notify(
            schedule,
            notice ?? result.reply.trim().slice(0, 300),
          );
      } else if (notice && schedule.notify) await this.notify(schedule, notice);
    } catch (error) {
      const message = errorText(error);
      this.logger.warn(`Agendamento "${schedule.title}": ${message}`);
      await this.schedules
        .finishRun(runId, { ok: false, summary: message, notice: null })
        .catch(() => undefined);
      // Um disparo que falha avisa sempre (mesmo os que estão sem avisos).
      await this.notify(schedule, `Não correu: ${message}`);
    }
  }

  private async notify(schedule: AgentSchedule, notice: string): Promise<void> {
    await this.notifications
      .openUserSubject({
        userId: schedule.userId,
        subject: `schedule:${schedule.id}`,
        kind: NotificationKind.AGENT_NOTICE,
        title: schedule.title,
        message: notice,
      })
      .catch((error: unknown) =>
        this.logger.warn(`Aviso do agendamento: ${errorText(error)}`),
      );
  }
}
