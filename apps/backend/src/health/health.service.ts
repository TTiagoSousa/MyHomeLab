import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, SleepSession } from 'src/generated/prisma/client/client';
import {
  HuaweiSampleRecord,
  parseHuaweiSleep,
} from './huawei/parseHuaweiSleep';
import { sleepAverages } from './helpers/sleepAverages';
import { HeartRateService } from './heart-rate.service';
import { SkinTemperatureService } from './skin-temperature.service';
import { BloodOxygenService } from './blood-oxygen.service';
import { StressService } from './stress.service';
import { ExerciseService } from './exercise.service';
import { StepsService } from './steps.service';
import { WeightService } from './weight.service';
import { WaterService } from './water.service';
import { HealthMetricsService } from './health-metrics.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const SOURCE_HUAWEI = 'HUAWEI';

/** Uma sessão para a lista, sem as fases (que só fazem falta ao abrir a noite). */
const toListView = (session: SleepSession) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { stages, userId, ...rest } = session;
  return { ...rest, night: session.night.toISOString().slice(0, 10) };
};

const toDetailView = (session: SleepSession) => ({
  ...toListView(session),
  stages: session.stages,
});

/**
 * A saúde do utilizador. Por agora só o sono, importado do export do Huawei
 * Health: uma linha por noite ou sesta, já com os totais, e as médias por
 * período. Os períodos contam a partir da última noite importada e não de
 * hoje — um export tem sempre uns dias de atraso.
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly heartRate: HeartRateService,
    private readonly skinTemperature: SkinTemperatureService,
    private readonly bloodOxygen: BloodOxygenService,
    private readonly stress: StressService,
    private readonly exercise: ExerciseService,
    private readonly steps: StepsService,
    private readonly weight: WeightService,
    private readonly water: WaterService,
    private readonly metrics: HealthMetricsService,
  ) {}

  /**
   * Recebe os ficheiros da pasta do export (o browser só manda os da pasta
   * "Sample sequence data") e grava as sessões de sono. Importar outra vez
   * atualiza as que já existem, pelo recordId da Huawei.
   */
  async importHuawei(
    userId: string,
    files: { originalname: string; buffer: Buffer }[],
  ) {
    if (!files?.length) {
      throw new BadRequestException({
        code: 'HEALTH_NO_FILES',
        message: 'Escolhe a pasta do export do Huawei Health.',
      });
    }

    const records: HuaweiSampleRecord[] = [];
    for (const file of files) {
      if (!file.originalname.toLowerCase().endsWith('.json')) continue;
      try {
        const parsed: unknown = JSON.parse(file.buffer.toString('utf8'));
        if (Array.isArray(parsed))
          records.push(...(parsed as HuaweiSampleRecord[]));
      } catch {
        // Um ficheiro que não é JSON (ou é outra coisa da pasta) fica de fora.
      }
    }

    const sessions = parseHuaweiSleep(records);
    if (!sessions.length) {
      throw new BadRequestException({
        code: 'HEALTH_NO_SLEEP',
        message:
          'Não encontrei dados de sono. Confirma que escolheste a pasta do export da Huawei (com a pasta "Sample sequence data").',
      });
    }

    let created = 0;
    for (const session of sessions) {
      const data = {
        ...session,
        night: new Date(`${session.night}T00:00:00Z`),
        baseline: (session.baseline ??
          Prisma.JsonNull) as Prisma.InputJsonValue,
        stages: session.stages as unknown as Prisma.InputJsonValue,
      };
      const key = {
        userId_source_externalId: {
          userId,
          source: SOURCE_HUAWEI,
          externalId: session.externalId,
        },
      };
      const existing = await this.prisma.sleepSession.findUnique({
        where: key,
        select: { id: true },
      });
      if (existing) {
        await this.prisma.sleepSession.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await this.prisma.sleepSession.create({
          data: { ...data, userId, source: SOURCE_HUAWEI },
        });
        created++;
      }
    }

    const nights = sessions
      .filter((session) => !session.isNap)
      .map((session) => session.night)
      .sort();
    return {
      sessions: sessions.length,
      nights: nights.length,
      naps: sessions.length - nights.length,
      created,
      updated: sessions.length - created,
      from: nights[0] ?? null,
      to: nights[nights.length - 1] ?? null,
    };
  }

  /**
   * O cartão de médias da página Saúde: sono, batimento, temperatura da pele,
   * oxigénio, stress, passos, exercício, peso, água e cada métrica da composição
   * e das medidas, cada um com os últimos 7, 30 e 90 dias.
   */
  async summary(userId: string) {
    return {
      metrics: await this.metrics.summary(userId),
      sleep: await this.sleepSummary(userId),
      heart: await this.heartRate.summary(userId),
      skinTemperature: await this.skinTemperature.summary(userId),
      bloodOxygen: await this.bloodOxygen.summary(userId),
      stress: await this.stress.summary(userId),
      steps: await this.steps.summary(userId),
      exercise: await this.exercise.summary(userId),
      weight: await this.weight.summary(userId),
      water: await this.water.summary(userId),
    };
  }

  private async sleepSummary(userId: string) {
    const latest = await this.prisma.sleepSession.findFirst({
      where: { userId, isNap: false },
      orderBy: { wakeAt: 'desc' },
    });
    if (!latest) return null;

    const last90 = await this.sessionsSince(userId, latest.night, 90);
    const within = (days: number) =>
      last90.filter(
        (session) =>
          session.night.getTime() > latest.night.getTime() - days * DAY_MS,
      );
    return {
      latestNight: toDetailView(latest),
      last7: sleepAverages(within(7)),
      last30: sleepAverages(within(30)),
      last90: sleepAverages(last90),
    };
  }

  /** O dashboard de sono: médias do período e a lista das noites (sem as fases). */
  async sleep(userId: string, days: number) {
    const latest = await this.prisma.sleepSession.findFirst({
      where: { userId },
      orderBy: { wakeAt: 'desc' },
      select: { night: true },
    });
    if (!latest) return { averages: null, sessions: [] };

    const sessions =
      days > 0
        ? await this.sessionsSince(userId, latest.night, days)
        : await this.prisma.sleepSession.findMany({ where: { userId } });
    sessions.sort((a, b) => b.wakeAt.getTime() - a.wakeAt.getTime());
    return {
      averages: sleepAverages(sessions),
      sessions: sessions.map(toListView),
    };
  }

  /** Uma noite com as fases, para o gráfico. */
  async sleepSession(userId: string, id: string) {
    const session = await this.prisma.sleepSession.findFirst({
      where: { id, userId },
    });
    if (!session) throw new NotFoundException('Noite não encontrada');
    return toDetailView(session);
  }

  private sessionsSince(userId: string, latestNight: Date, days: number) {
    return this.prisma.sleepSession.findMany({
      where: {
        userId,
        night: { gt: new Date(latestNight.getTime() - days * DAY_MS) },
      },
    });
  }
}
