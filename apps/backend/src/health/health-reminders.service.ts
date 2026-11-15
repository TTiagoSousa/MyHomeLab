import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MedicalService } from './medical.service';
import { localDay, localMinute } from './helpers/timeZone';

export type ReminderMoment = 'morning' | 'evening';

export interface HealthReminder {
  key: string;
  text: string;
}

const SPECIALTY_NAMES: Record<string, string> = {
  GENERAL: 'Medicina geral',
  DENTIST: 'Dentista',
  EYES: 'Oftalmologia',
  DERMATOLOGY: 'Dermatologia',
  CARDIOLOGY: 'Cardiologia',
  ORTHOPEDICS: 'Ortopedia',
  PHYSIOTHERAPY: 'Fisioterapia',
  PSYCHOLOGY: 'Psicologia',
  OTHER: 'Consulta',
};

/** Os lembretes saem à hora de Portugal; é também por aqui que se sabe que dia é hoje. */
export const REMINDER_TIME_ZONE = 'Europe/Lisbon';

const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (value: number) => String(value).padStart(2, '0');
const shortDate = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

/**
 * Os lembretes de saúde que vão para as notificações (site e app). De manhã: as consultas do dia,
 * as voltas ao médico da próxima semana, os reforços de vacinas das próximas
 * duas semanas e a troca das lentes. À noite: as consultas de amanhã. Cada um
 * vai uma vez só (fica marcado em HealthReminderSent).
 */
@Injectable()
export class HealthRemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly medical: MedicalService,
  ) {}

  async due(
    userId: string,
    now: Date,
    moment: ReminderMoment,
  ): Promise<HealthReminder[]> {
    const items = await this.medical.upcoming(userId, now, 14);
    const appointments = await this.prisma.medicalAppointment.findMany({
      where: {
        userId,
        at: { gte: now, lte: new Date(now.getTime() + 2 * DAY_MS) },
      },
    });
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: REMINDER_TIME_ZONE,
    }).format(now);
    const tomorrow = new Date(new Date(`${today}T12:00:00Z`).getTime() + DAY_MS)
      .toISOString()
      .slice(0, 10);
    const inDays = (day: string) =>
      Math.round(
        (new Date(`${day}T12:00:00Z`).getTime() -
          new Date(`${today}T12:00:00Z`).getTime()) /
          DAY_MS,
      );

    const reminders: HealthReminder[] = [];
    for (const appointment of appointments) {
      const day = localDay(appointment.at, appointment.timeZone);
      const minute = localMinute(appointment.at, appointment.timeZone);
      const clock = `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
      const who = [appointment.doctor, appointment.place]
        .filter(Boolean)
        .join(', ');
      const what = `${SPECIALTY_NAMES[appointment.specialty] ?? 'Consulta'}${who ? ` (${who})` : ''}`;
      if (moment === 'morning' && day === today)
        reminders.push({
          key: `appointment:${appointment.id}:day`,
          text: `📅 Hoje às ${clock}: ${what}.`,
        });
      if (moment === 'evening' && day === tomorrow)
        reminders.push({
          key: `appointment:${appointment.id}:eve`,
          text: `📅 Amanhã às ${clock}: ${what}.`,
        });
    }

    if (moment === 'morning') {
      for (const item of items) {
        const days = inDays(item.date);
        if (item.kind === 'FOLLOW_UP' && days <= 7) {
          const name = SPECIALTY_NAMES[item.title] ?? item.title;
          reminders.push({
            key: `followup:${item.id}:${item.date}`,
            text: `🔁 Está na altura de marcar ${name} (era para voltar até ${shortDate(item.date)}).`,
          });
        }
        if (item.kind === 'VACCINE' && days <= 14)
          reminders.push({
            key: `vaccine:${item.id}:${item.date}`,
            text: `💉 O reforço da vacina ${item.title} é a ${shortDate(item.date)}.`,
          });
        if (item.kind === 'LENS' && days <= 1)
          reminders.push({
            key: `lens:${item.id}:${item.date}`,
            text:
              days <= 0
                ? '👁 Hoje é dia de trocar as lentes de contacto.'
                : '👁 Amanhã é dia de trocar as lentes de contacto.',
          });
      }
    }

    if (!reminders.length) return [];
    const sent = await this.prisma.healthReminderSent.findMany({
      where: { userId, key: { in: reminders.map((reminder) => reminder.key) } },
      select: { key: true },
    });
    const already = new Set(sent.map((reminder) => reminder.key));
    return reminders.filter((reminder) => !already.has(reminder.key));
  }

  async markSent(userId: string, keys: string[]) {
    await this.prisma.healthReminderSent.createMany({
      data: keys.map((key) => ({ userId, key })),
      skipDuplicates: true,
    });
  }
}
