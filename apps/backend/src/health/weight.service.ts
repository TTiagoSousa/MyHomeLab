import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WeightEntry } from 'src/generated/prisma/client/client';
import { SaveWeightDto } from './dto/save-weight.dto';
import { weightAverages } from './helpers/weightAverages';
import { localDay } from './helpers/timeZone';
import { roundTo } from './helpers/readings';

const DAY_MS = 24 * 60 * 60 * 1000;

const dayOf = (entry: { day: Date }) => entry.day.toISOString().slice(0, 10);

/**
 * As pesagens, registadas à mão. Como nas outras métricas, os períodos contam
 * a partir da pesagem mais recente.
 */
@Injectable()
export class WeightService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: SaveWeightDto) {
    const measuredAt = new Date(dto.measuredAt);
    const entry = await this.prisma.weightEntry.create({
      data: {
        userId,
        measuredAt,
        day: new Date(`${localDay(measuredAt, dto.timeZone)}T00:00:00Z`),
        timeZone: dto.timeZone,
        weightKg: roundTo(dto.weightKg, 2),
      },
    });
    return { id: entry.id };
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.weightEntry.deleteMany({
      where: { id, userId },
    });
    if (!count) throw new NotFoundException('Pesagem não encontrada');
    return { deleted: true };
  }

  /** Para o cartão de médias da página Saúde: últimos 7, 30 e 90 dias. */
  async summary(userId: string) {
    const latest = await this.latestDay(userId);
    if (!latest) return null;

    const last90 = await this.entriesSince(userId, latest, 90);
    const within = (days: number) =>
      last90.filter(
        (entry) => entry.day.getTime() > latest.getTime() - days * DAY_MS,
      );
    return {
      latestDay: dayOf({ day: latest }),
      last7: weightAverages(within(7)),
      last30: weightAverages(within(30)),
      last90: weightAverages(last90),
    };
  }

  /**
   * O dashboard: as médias do período e as pesagens, da mais recente para a
   * mais antiga, cada uma com a diferença para a anterior.
   */
  async weight(userId: string, days: number) {
    const latest = await this.latestDay(userId);
    if (!latest) return { averages: null, entries: [] };

    const entries =
      days > 0
        ? await this.entriesSince(userId, latest, days)
        : await this.prisma.weightEntry.findMany({ where: { userId } });
    entries.sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime());

    return {
      averages: weightAverages(entries),
      entries: entries
        .map((entry, index) => toView(entry, entries[index - 1]))
        .reverse(),
    };
  }

  private async latestDay(userId: string) {
    const latest = await this.prisma.weightEntry.findFirst({
      where: { userId },
      orderBy: { measuredAt: 'desc' },
      select: { day: true },
    });
    return latest?.day ?? null;
  }

  private entriesSince(userId: string, latest: Date, days: number) {
    return this.prisma.weightEntry.findMany({
      where: {
        userId,
        day: { gt: new Date(latest.getTime() - days * DAY_MS) },
      },
    });
  }
}

const toView = (entry: WeightEntry, previous?: WeightEntry) => ({
  id: entry.id,
  day: dayOf(entry),
  measuredAt: entry.measuredAt,
  timeZone: entry.timeZone,
  weightKg: entry.weightKg,
  changeKg: previous ? roundTo(entry.weightKg - previous.weightKg, 1) : null,
});
