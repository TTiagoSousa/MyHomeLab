import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StressDay, Prisma } from 'src/generated/prisma/client/client';
import {
  HuaweiStressPayload,
  parseHuaweiStress,
} from './huawei/parseHuaweiStress';
import { stressAverages } from './helpers/stressAverages';

const DAY_MS = 24 * 60 * 60 * 1000;
const SOURCE_HUAWEI = 'HUAWEI';

/** Um dia para a tabela: sem os pontos, que só fazem falta ao abrir o dia. */
const toListView = (entry: StressDay) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { points, userId, ...rest } = entry;
  return { ...rest, day: entry.day.toISOString().slice(0, 10) };
};

const toDetailView = (entry: StressDay) => ({
  ...toListView(entry),
  points: entry.points,
});

/**
 * O stress do utilizador, por dia. Tal como no sono, os períodos
 * contam a partir do último dia importado e não de hoje.
 */
@Injectable()
export class StressService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recebe o ficheiro que o browser montou com as leituras do export (ver
   * HuaweiStressPayload) e grava um registo por dia. Importar outra vez
   * substitui os dias que já existem — um export novo traz sempre o dia todo.
   */
  async importHuawei(userId: string, file?: { buffer: Buffer }) {
    let payload: HuaweiStressPayload;
    try {
      payload = JSON.parse(
        file?.buffer.toString('utf8') ?? '',
      ) as HuaweiStressPayload;
    } catch {
      throw new BadRequestException({
        code: 'HEALTH_NO_STRESS',
        message: 'O ficheiro do stress não é válido.',
      });
    }

    const days = parseHuaweiStress(payload);
    if (!days.length) {
      throw new BadRequestException({
        code: 'HEALTH_NO_STRESS',
        message:
          'Não encontrei medições de stress. Confirma que escolheste a pasta do export da Huawei (com a pasta "Health detail data").',
      });
    }

    let created = 0;
    for (const entry of days) {
      const data = {
        ...entry,
        day: new Date(`${entry.day}T00:00:00Z`),
        levels: entry.levels as unknown as Prisma.InputJsonValue,
        points: entry.points as unknown as Prisma.InputJsonValue,
      };
      const existing = await this.prisma.stressDay.findUnique({
        where: {
          userId_source_day: { userId, source: SOURCE_HUAWEI, day: data.day },
        },
        select: { id: true },
      });
      if (existing) {
        await this.prisma.stressDay.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await this.prisma.stressDay.create({
          data: { ...data, userId, source: SOURCE_HUAWEI },
        });
        created++;
      }
    }

    return {
      days: days.length,
      created,
      updated: days.length - created,
      from: days[0].day,
      to: days[days.length - 1].day,
    };
  }

  /** Para o cartão de médias da página Saúde: últimos 7, 30 e 90 dias e o último dia. */
  async summary(userId: string) {
    const latest = await this.prisma.stressDay.findFirst({
      where: { userId },
      orderBy: { day: 'desc' },
    });
    if (!latest) return null;

    const last90 = await this.daysSince(userId, latest.day, 90);
    const within = (days: number) =>
      last90.filter(
        (entry) => entry.day.getTime() > latest.day.getTime() - days * DAY_MS,
      );
    return {
      latestDay: toListView(latest),
      last7: stressAverages(within(7)),
      last30: stressAverages(within(30)),
      last90: stressAverages(last90),
    };
  }

  /** O dashboard: médias do período e a lista dos dias (sem os pontos). */
  async days(userId: string, days: number) {
    const latest = await this.prisma.stressDay.findFirst({
      where: { userId },
      orderBy: { day: 'desc' },
      select: { day: true },
    });
    if (!latest) return { averages: null, days: [] };

    const entries =
      days > 0
        ? await this.daysSince(userId, latest.day, days)
        : await this.prisma.stressDay.findMany({ where: { userId } });
    entries.sort((a, b) => b.day.getTime() - a.day.getTime());
    return {
      averages: stressAverages(entries),
      days: entries.map(toListView),
    };
  }

  /** Um dia com os pontos, para o gráfico. */
  async day(userId: string, id: string) {
    const entry = await this.prisma.stressDay.findFirst({
      where: { id, userId },
    });
    if (!entry) throw new NotFoundException('Dia não encontrado');
    return toDetailView(entry);
  }

  private daysSince(userId: string, latestDay: Date, days: number) {
    return this.prisma.stressDay.findMany({
      where: {
        userId,
        day: { gt: new Date(latestDay.getTime() - days * DAY_MS) },
      },
    });
  }
}
