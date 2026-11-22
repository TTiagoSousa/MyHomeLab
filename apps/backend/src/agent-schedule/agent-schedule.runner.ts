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
import {
  AgentScheduleService,
  UNHANDLED_SUBJECT,
} from './agent-schedule.service';
import { scheduleNotice } from './helpers/scheduleNotice';
import { newUpdatesText } from './helpers/newUpdatesText';

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
      // Os "quando aparece uma atualização nova": correm com as que apareceram.
      for (const {
        schedule,
        updates,
      } of await this.schedules.takeNewUpdates()) {
        const run = await this.schedules.startRun(schedule.id);
        void this.execute(schedule, run.id, newUpdatesText(updates));
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

  // De hora a hora: quem tem atualizações disponíveis sem nenhum agendamento que trate
  // delas recebe um aviso (fecha-se sozinho quando deixa de ser verdade).
  @Cron('0 5 * * * *', { name: 'Atualizações sem agendamento' })
  async warnUnhandledUpdates(): Promise<void> {
    try {
      for (const { userId, count } of await this.schedules.unhandledUpdates()) {
        if (!count) {
          await this.notifications.resolveUserSubject(
            userId,
            UNHANDLED_SUBJECT,
            NotificationKind.AGENT_NOTICE,
          );
          continue;
        }
        await this.notifications.openUserSubject({
          userId,
          subject: UNHANDLED_SUBJECT,
          kind: NotificationKind.AGENT_NOTICE,
          title: 'Atualizações à espera de um agendamento',
          message: `Há ${count === 1 ? '1 atualização disponível' : `${count} atualizações disponíveis`} e nenhum agendamento trata delas. Pede ao Jarvis, por exemplo: "sempre que aparecer uma atualização nova, trata dela" ou "todos os dias às 8h vê as atualizações".`,
        });
      }
    } catch (error) {
      this.logger.warn(`Atualizações sem agendamento: ${errorText(error)}`);
    }
  }

  private async execute(
    schedule: AgentSchedule,
    runId: string,
    extra?: string,
  ): Promise<void> {
    try {
      const result = await this.assistant.runScheduled(schedule, extra);
      // Os disparos das atualizações novas não avisam: cada atualização tem o seu cartão.
      const fromUpdates = extra !== undefined;
      const notice =
        schedule.updateId || fromUpdates ? null : scheduleNotice(result.reply);
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
        if (schedule.notify && !fromUpdates)
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
