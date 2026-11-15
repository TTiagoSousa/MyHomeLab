import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from 'src/notification/notification.service';
import { NotificationKind } from 'src/generated/prisma/client/client';
import {
  HealthRemindersService,
  REMINDER_TIME_ZONE,
  ReminderMoment,
} from './health-reminders.service';

/**
 * Os lembretes de saúde nas notificações (o site e a app), às 9h (o dia) e às 20h
 * (amanhã). Cada lembrete vai uma vez só.
 */
@Injectable()
export class HealthReminderScheduler {
  private readonly logger = new Logger(HealthReminderScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reminders: HealthRemindersService,
    private readonly notifications: NotificationService,
  ) {}

  @Cron('0 0 9 * * *', {
    timeZone: REMINDER_TIME_ZONE,
    name: 'Lembretes de saúde (manhã)',
  })
  morning(): Promise<void> {
    return this.send('morning');
  }

  @Cron('0 0 20 * * *', {
    timeZone: REMINDER_TIME_ZONE,
    name: 'Lembretes de saúde (noite)',
  })
  evening(): Promise<void> {
    return this.send('evening');
  }

  async send(moment: ReminderMoment): Promise<void> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    for (const { id: userId } of users) {
      try {
        const due = await this.reminders.due(userId, new Date(), moment);
        if (!due.length) continue;
        await this.notifications.openUserSubject({
          userId,
          subject: `health-reminder:${moment}`,
          kind: NotificationKind.AGENT_NOTICE,
          title: 'Lembretes de saúde',
          message: due.map((reminder) => reminder.text).join('\n'),
        });
        await this.reminders.markSent(
          userId,
          due.map((reminder) => reminder.key),
        );
      } catch (error) {
        this.logger.error(
          `Falha a enviar os lembretes de saúde (${userId})`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }
}
