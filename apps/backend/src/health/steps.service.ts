import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityDay, Prisma } from 'src/generated/prisma/client/client';
import {
  HuaweiActivityPayload,
  parseHuaweiActivity,
} from './huawei/parseHuaweiActivity';
import { stepsAverages } from './helpers/stepsAverages';

const DAY_MS = 24 * 60 * 60 * 1000;
const SOURCE_HUAWEI = 'HUAWEI';

/** Um dia para a tabela: sem os passos por hora, que só fazem falta ao abrir o dia. */
const toListView = (entry: ActivityDay) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { hourly, userId, ...rest } = entry;
  return { ...rest, day: entry.day.toISOString().slice(0, 10) };
};

/**
 * Os passos do utilizador, por dia (com a distância, as calorias ativas e os
 * minutos ativos). Os períodos contam a partir do último dia importado.
 */
@Injectable()
export class StepsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recebe o ficheiro que o browser montou com os minutos de atividade da
   * pasta "Sport per minute merged data" e grava um registo por dia.
   * Importar outra vez substitui os dias que já existem.
   */
  async importHuawei(userId: string, file?: { buffer: Buffer }) {
    let payload: HuaweiActivityPayload;
    try {
      payload = JSON.parse(
        file?.buffer.toString('utf8') ?? '',
      ) as HuaweiActivityPayload;
    } catch {
      throw new BadRequestException({
        code: 'HEALTH_NO_STEPS',
        message: 'O ficheiro dos passos não é válido.',
      });
    }

    const days = parseHuaweiActivity(payload);
    if (!days.length) {
      throw new BadRequestException({
        code: 'HEALTH_NO_STEPS',
        message:
          'Não encontrei passos. Confirma que escolheste a pasta do export da Huawei (com a pasta "Sport per minute merged data").',
      });
    }

    let created = 0;
    for (const entry of days) {
      const data = {
        ...entry,
        day: new Date(`${entry.day}T00:00:00Z`),
        hourly: entry.hourly as unknown as Prisma.InputJsonValue,
      };
      const existing = await this.prisma.activityDay.findUnique({
        where: {
          userId_source_day: { userId, source: SOURCE_HUAWEI, day: data.day },
        },
        select: { id: true },
      });
      if (existing) {
        await this.prisma.activityDay.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await this.prisma.activityDay.create({
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
    const latest = await this.prisma.activityDay.findFirst({
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
      last7: stepsAverages(within(7)),
      last30: stepsAverages(within(30)),
      last90: stepsAverages(last90),
    };
  }

  /** O dashboard: médias do período e a lista dos dias (sem os passos por hora). */
  async days(userId: string, days: number) {
    const latest = await this.prisma.activityDay.findFirst({
      where: { userId },
      orderBy: { day: 'desc' },
      select: { day: true },
    });
    if (!latest) return { averages: null, days: [] };

    const entries =
      days > 0
        ? await this.daysSince(userId, latest.day, days)
        : await this.prisma.activityDay.findMany({ where: { userId } });
    entries.sort((a, b) => b.day.getTime() - a.day.getTime());
    return {
      averages: stepsAverages(entries),
      days: entries.map(toListView),
    };
  }

  /** Um dia com os passos por hora, para o gráfico. */
  async day(userId: string, id: string) {
    const entry = await this.prisma.activityDay.findFirst({
      where: { id, userId },
    });
    if (!entry) throw new NotFoundException('Dia não encontrado');
    return { ...toListView(entry), hourly: entry.hourly };
  }

  private daysSince(userId: string, latestDay: Date, days: number) {
    return this.prisma.activityDay.findMany({
      where: {
        userId,
        day: { gt: new Date(latestDay.getTime() - days * DAY_MS) },
      },
    });
  }
}
