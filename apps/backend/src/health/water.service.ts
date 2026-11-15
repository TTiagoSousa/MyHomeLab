import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SaveWaterDto } from './dto/save-water.dto';
import { waterDays } from './helpers/waterDays';
import { waterAverages } from './helpers/waterAverages';
import { localDay } from './helpers/timeZone';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A água bebida, registada à mão (um registo por copo ou garrafa). O
 * dashboard soma-a por dia; os períodos contam a partir do dia mais recente
 * com registos.
 */
@Injectable()
export class WaterService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: SaveWaterDto) {
    const drankAt = new Date(dto.drankAt);
    const entry = await this.prisma.waterEntry.create({
      data: {
        userId,
        drankAt,
        day: new Date(`${localDay(drankAt, dto.timeZone)}T00:00:00Z`),
        timeZone: dto.timeZone,
        ml: dto.ml,
      },
    });
    return { id: entry.id };
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.waterEntry.deleteMany({
      where: { id, userId },
    });
    if (!count) throw new NotFoundException('Registo de água não encontrado');
    return { deleted: true };
  }

  /** Para o cartão de médias da página Saúde: últimos 7, 30 e 90 dias. */
  async summary(userId: string) {
    const latest = await this.latestDay(userId);
    if (!latest) return null;

    const last90 = waterDays(await this.entriesSince(userId, latest, 90));
    const within = (days: number) => {
      const since = new Date(latest.getTime() - days * DAY_MS)
        .toISOString()
        .slice(0, 10);
      return last90.filter((day) => day.day > since);
    };
    return {
      latestDay: latest.toISOString().slice(0, 10),
      last7: waterAverages(within(7)),
      last30: waterAverages(within(30)),
      last90: waterAverages(last90),
    };
  }

  /** O dashboard: as médias do período e os dias, cada um com os seus registos. */
  async water(userId: string, days: number) {
    const latest = await this.latestDay(userId);
    if (!latest) return { averages: null, days: [] };

    const grouped = waterDays(
      days > 0
        ? await this.entriesSince(userId, latest, days)
        : await this.prisma.waterEntry.findMany({ where: { userId } }),
    );
    return { averages: waterAverages(grouped), days: grouped };
  }

  private async latestDay(userId: string) {
    const latest = await this.prisma.waterEntry.findFirst({
      where: { userId },
      orderBy: { day: 'desc' },
      select: { day: true },
    });
    return latest?.day ?? null;
  }

  private entriesSince(userId: string, latest: Date, days: number) {
    return this.prisma.waterEntry.findMany({
      where: {
        userId,
        day: { gt: new Date(latest.getTime() - days * DAY_MS) },
      },
    });
  }
}
