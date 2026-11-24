import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WeightService } from './weight.service';
import { BodyService } from './body.service';
import { SaveMetricValueDto } from './dto/save-metric-value.dto';
import { checkedValues } from './helpers/checkedValues';
import { localDayDate } from './helpers/localDayDate';
import { BODY_FIELDS, COMPOSITION_FIELDS } from './helpers/healthMetrics';
import {
  HEALTH_METRICS,
  isBodyField,
  type HealthMetric,
} from './helpers/healthMetrics';
import { metricAverages, type MetricPoint } from './helpers/metricAverages';
import { roundTo } from './helpers/readings';
import { dayOf } from './helpers/dayOf';

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT = 5;

interface MetricRow extends MetricPoint {
  id: string;
  timeZone: string | null;
  device: string | null;
}

/**
 * As métricas com página própria: a composição corporal (das pesagens) e as
 * medidas de fita (do Corpo). Os períodos contam a partir do valor mais recente.
 */
@Injectable()
export class HealthMetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weight: WeightService,
    private readonly body: BodyService,
  ) {}

  /**
   * Mete um valor na página da métrica: da balança vira uma pesagem só com esse
   * valor (e o aparelho); de fita junta-se ao dia do Corpo sem apagar as outras.
   */
  async addValue(
    userId: string,
    metric: HealthMetric,
    dto: SaveMetricValueDto,
  ) {
    const values = checkedValues([metric], { [metric]: dto.value });
    if (isBodyField(metric)) {
      const day = localDayDate(new Date(dto.measuredAt), dto.timeZone);
      await this.body.mergeMeasurement(userId, day, values);
    } else if (dto.entryId) {
      // a mesma medição: o valor entra na pesagem escolhida
      const { count } = await this.prisma.weightEntry.updateMany({
        where: { id: dto.entryId, userId },
        data: values,
      });
      if (!count) throw new NotFoundException('Medição não encontrada');
    } else {
      await this.weight.create(userId, {
        ...values,
        deviceId: dto.deviceId,
        measuredAt: dto.measuredAt,
        timeZone: dto.timeZone,
      });
    }
    return { saved: true };
  }

  /**
   * Tira só este valor do registo (pesagem ou dia do Corpo); o registo vai
   * embora quando fica sem nenhum valor.
   */
  async removeValue(userId: string, metric: HealthMetric, id: string) {
    if (isBodyField(metric)) {
      const row = await this.prisma.bodyMeasurement.findFirst({
        where: { id, userId },
      });
      if (!row || row[metric] == null)
        throw new NotFoundException('Valor não encontrado');
      const empty =
        BODY_FIELDS.every((field) => field === metric || row[field] == null) &&
        !row.notes;
      if (empty) await this.prisma.bodyMeasurement.delete({ where: { id } });
      else
        await this.prisma.bodyMeasurement.update({
          where: { id },
          data: { [metric]: null },
        });
      return { deleted: true };
    }
    const row = await this.prisma.weightEntry.findFirst({
      where: { id, userId },
    });
    if (!row || row[metric] == null)
      throw new NotFoundException('Valor não encontrado');
    const empty =
      row.weightKg == null &&
      COMPOSITION_FIELDS.every(
        (field) => field === metric || row[field] == null,
      );
    if (empty) await this.prisma.weightEntry.delete({ where: { id } });
    else
      await this.prisma.weightEntry.update({
        where: { id },
        data: { [metric]: null },
      });
    return { deleted: true };
  }

  /** O dashboard de uma métrica: as médias e os valores, do mais recente para o mais antigo. */
  async metric(userId: string, metric: HealthMetric, days: number) {
    const rows = await this.rows(userId, metric);
    if (!rows.length) return { averages: null, points: [] };

    const latest = rows[rows.length - 1].at.getTime();
    const inPeriod =
      days > 0 ? rows.filter((row) => withinDays(row, latest, days)) : rows;
    return {
      averages: metricAverages(inPeriod),
      points: inPeriod
        .map((row, index) => ({
          id: row.id,
          day: row.day,
          at: row.at,
          timeZone: row.timeZone,
          device: row.device,
          value: row.value,
          change:
            index > 0
              ? roundTo(row.value - inPeriod[index - 1].value, 1)
              : null,
        }))
        .reverse(),
    };
  }

  /** Para o cartão de médias da página Saúde: cada métrica com 7, 30 e 90 dias (null sem dados). */
  async summary(userId: string) {
    const [weighings, measurements] = await Promise.all([
      this.prisma.weightEntry.findMany({ where: { userId } }),
      this.prisma.bodyMeasurement.findMany({ where: { userId } }),
    ]);
    const entries = HEALTH_METRICS.map((metric) => {
      const rows = isBodyField(metric)
        ? measurements.flatMap((row) =>
            row[metric] == null
              ? []
              : [
                  {
                    day: dayOf(row.day)!,
                    at: new Date(`${dayOf(row.day)}T12:00:00Z`),
                    value: row[metric],
                  },
                ],
          )
        : weighings.flatMap((row) =>
            row[metric] == null
              ? []
              : [
                  {
                    day: dayOf(row.day)!,
                    at: row.measuredAt,
                    value: row[metric],
                  },
                ],
          );
      return [metric, periods(rows)] as const;
    });
    return Object.fromEntries(entries);
  }

  private async rows(
    userId: string,
    metric: HealthMetric,
  ): Promise<MetricRow[]> {
    if (isBodyField(metric)) {
      const measurements = await this.prisma.bodyMeasurement.findMany({
        where: { userId, [metric]: { not: null } },
        orderBy: { day: 'asc' },
      });
      return measurements.map((row) => ({
        id: row.id,
        day: dayOf(row.day)!,
        at: new Date(`${dayOf(row.day)}T12:00:00Z`),
        timeZone: null,
        device: null,
        value: row[metric]!,
      }));
    }
    const weighings = await this.prisma.weightEntry.findMany({
      where: { userId, [metric]: { not: null } },
      orderBy: { measuredAt: 'asc' },
      include: { device: { select: { name: true } } },
    });
    return weighings.map((row) => ({
      id: row.id,
      day: dayOf(row.day)!,
      at: row.measuredAt,
      timeZone: row.timeZone,
      device: row.device?.name ?? null,
      value: row[metric]!,
    }));
  }
}

const withinDays = (row: MetricPoint, latest: number, days: number) =>
  row.at.getTime() > latest - days * DAY_MS;

const periods = (rows: MetricPoint[]) => {
  if (!rows.length) return null;
  const last = rows.reduce((newest, row) =>
    row.at > newest.at ? row : newest,
  );
  const latest = last.at.getTime();
  const within = (days: number) =>
    rows.filter((row) => withinDays(row, latest, days));
  return {
    latestDay: last.day,
    last7: metricAverages(within(7)),
    last30: metricAverages(within(30)),
    last90: metricAverages(within(90)),
    // os últimos valores, para o cartão de médias
    recent: [...rows]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, RECENT)
      .map((row) => ({ day: row.day, value: row.value })),
  };
};
