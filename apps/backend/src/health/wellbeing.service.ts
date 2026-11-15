import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Fast, MoodEntry } from 'src/generated/prisma/client/client';
import {
  SaveFastDto,
  SaveHabitDto,
  SaveMoodDto,
} from './dto/save-health-logs.dto';
import { dateOnly } from './helpers/dateOnly';
import { dayOf } from './helpers/dayOf';
import { habitStreaks } from './helpers/habitStreaks';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Quantos dias de hábitos cumpridos vão para o browser (a grelha e as sequências). */
const HABIT_DAYS = 400;

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toMoodView = (entry: MoodEntry) => ({
  day: dayOf(entry.day),
  mood: entry.mood,
  energy: entry.energy,
  motivation: entry.motivation,
  note: entry.note,
});

const toFastView = (fast: Fast) => ({
  id: fast.id,
  startAt: fast.startAt,
  endAt: fast.endAt,
  targetHours: fast.targetHours,
  notes: fast.notes,
  hours: fast.endAt
    ? Math.round(
        ((fast.endAt.getTime() - fast.startAt.getTime()) / 3_600_000) * 10,
      ) / 10
    : null,
});

/**
 * A mente e os hábitos: humor, energia e motivação por dia, hábitos diários
 * com sequências e jejuns.
 */
@Injectable()
export class WellbeingService {
  constructor(private readonly prisma: PrismaService) {}

  /** `today` é o dia local do browser, para as sequências dos hábitos. */
  async wellbeing(userId: string, days: number, today: string) {
    const day = this.checkDay(today);
    const [moods, habits, fasts] = await Promise.all([
      this.prisma.moodEntry.findMany({
        where: {
          userId,
          ...(days > 0
            ? { day: { gte: new Date(day.getTime() - (days - 1) * DAY_MS) } }
            : {}),
        },
        orderBy: { day: 'desc' },
      }),
      this.prisma.habit.findMany({
        where: { userId },
        orderBy: [
          { archived: 'asc' },
          { position: 'asc' },
          { createdAt: 'asc' },
        ],
        include: {
          checks: {
            where: {
              day: { gte: new Date(day.getTime() - HABIT_DAYS * DAY_MS) },
            },
            select: { day: true },
          },
        },
      }),
      this.prisma.fast.findMany({
        where: { userId },
        orderBy: { startAt: 'desc' },
        take: 60,
      }),
    ]);

    return {
      moods: moods.map(toMoodView),
      habits: habits.map((habit) => {
        const checks = habit.checks.map((check) => dayOf(check.day)!).sort();
        return {
          id: habit.id,
          name: habit.name,
          position: habit.position,
          archived: habit.archived,
          checks,
          ...habitStreaks(checks, today),
        };
      }),
      fasts: fasts.map(toFastView),
    };
  }

  async saveMood(userId: string, day: string, dto: SaveMoodDto) {
    const date = this.checkDay(day);
    const data = {
      mood: dto.mood,
      energy: dto.energy,
      motivation: dto.motivation,
      note: dto.note?.trim() || null,
    };
    const entry = await this.prisma.moodEntry.upsert({
      where: { userId_day: { userId, day: date } },
      create: { userId, day: date, ...data },
      update: data,
    });
    return toMoodView(entry);
  }

  async removeMood(userId: string, day: string) {
    const { count } = await this.prisma.moodEntry.deleteMany({
      where: { userId, day: this.checkDay(day) },
    });
    if (!count) throw new NotFoundException('Esse dia não tem humor registado');
    return { deleted: true };
  }

  async createHabit(userId: string, dto: SaveHabitDto) {
    const count = await this.prisma.habit.count({ where: { userId } });
    const habit = await this.prisma.habit.create({
      data: { userId, name: dto.name.trim(), position: dto.position ?? count },
    });
    return { id: habit.id };
  }

  async updateHabit(userId: string, id: string, dto: SaveHabitDto) {
    await this.findHabit(userId, id);
    await this.prisma.habit.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        ...(dto.archived !== undefined ? { archived: dto.archived } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
      },
    });
    return { id };
  }

  async removeHabit(userId: string, id: string) {
    await this.findHabit(userId, id);
    await this.prisma.habit.delete({ where: { id } });
    return { deleted: true };
  }

  async checkHabit(userId: string, id: string, day: string, done: boolean) {
    await this.findHabit(userId, id);
    const date = this.checkDay(day);
    if (done) {
      await this.prisma.habitCheck.upsert({
        where: { habitId_day: { habitId: id, day: date } },
        create: { habitId: id, day: date },
        update: {},
      });
    } else {
      await this.prisma.habitCheck.deleteMany({
        where: { habitId: id, day: date },
      });
    }
    return { done };
  }

  /** Só pode haver um jejum a decorrer de cada vez. */
  async createFast(userId: string, dto: SaveFastDto) {
    if (!dto.endAt) {
      const open = await this.prisma.fast.findFirst({
        where: { userId, endAt: null },
        select: { id: true },
      });
      if (open) {
        throw new BadRequestException({
          code: 'HEALTH_FAST_OPEN',
          message: 'Já tens um jejum a decorrer. Termina-o primeiro.',
        });
      }
    }
    const fast = await this.prisma.fast.create({
      data: { userId, ...this.fastData(dto) },
    });
    return toFastView(fast);
  }

  async updateFast(userId: string, id: string, dto: SaveFastDto) {
    await this.findFast(userId, id);
    const fast = await this.prisma.fast.update({
      where: { id },
      data: this.fastData(dto),
    });
    return toFastView(fast);
  }

  async removeFast(userId: string, id: string) {
    await this.findFast(userId, id);
    await this.prisma.fast.delete({ where: { id } });
    return { deleted: true };
  }

  private fastData(dto: SaveFastDto) {
    const startAt = new Date(dto.startAt);
    const endAt = dto.endAt ? new Date(dto.endAt) : null;
    if (endAt && endAt <= startAt) {
      throw new BadRequestException({
        code: 'HEALTH_FAST_DATES',
        message: 'O fim do jejum tem de ser depois do início.',
      });
    }
    return {
      startAt,
      endAt,
      targetHours: dto.targetHours,
      notes: dto.notes?.trim() || null,
    };
  }

  private checkDay(day: string) {
    if (!DAY_PATTERN.test(day)) {
      throw new BadRequestException({
        code: 'HEALTH_DAY',
        message: 'O dia tem de vir como AAAA-MM-DD.',
      });
    }
    return dateOnly(day)!;
  }

  private async findHabit(userId: string, id: string) {
    const habit = await this.prisma.habit.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!habit) throw new NotFoundException('Hábito não encontrado');
  }

  private async findFast(userId: string, id: string) {
    const fast = await this.prisma.fast.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!fast) throw new NotFoundException('Jejum não encontrado');
  }
}
