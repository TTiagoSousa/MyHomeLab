import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  MeasurementDevice,
  WeightEntry,
} from 'src/generated/prisma/client/client';
import { SaveWeightDto } from './dto/save-weight.dto';
import { weightAverages } from './helpers/weightAverages';
import { localDay } from './helpers/timeZone';
import { roundTo } from './helpers/readings';
import { checkedValues } from './helpers/checkedValues';
import {
  COMPOSITION_FIELDS,
  type CompositionField,
} from './helpers/healthMetrics';

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT = 5;

const WEIGHING_FIELDS = ['weightKg', ...COMPOSITION_FIELDS] as const;

const dayOf = (entry: { day: Date }) => entry.day.toISOString().slice(0, 10);

type EntryWithDevice = WeightEntry & { device: MeasurementDevice | null };

/**
 * As pesagens, registadas à mão: o peso e a composição corporal da balança.
 * Como nas outras métricas, os períodos contam a partir da pesagem mais recente.
 */
@Injectable()
export class WeightService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: SaveWeightDto) {
    const values = checkedValues(WEIGHING_FIELDS, dto);
    if (!Object.keys(values).length) {
      throw new BadRequestException({
        code: 'HEALTH_WEIGHT_EMPTY',
        message: 'Mete o peso ou pelo menos uma medida da composição.',
      });
    }
    // O peso sem gordura sai do peso e da gordura quando a balança não o dá.
    if (
      values.leanKg == null &&
      values.weightKg != null &&
      values.bodyFatPct != null
    ) {
      values.leanKg = roundTo(
        values.weightKg * (1 - values.bodyFatPct / 100),
        2,
      );
    }
    const measuredAt = new Date(dto.measuredAt);
    const entry = await this.prisma.weightEntry.create({
      data: {
        userId,
        measuredAt,
        day: new Date(`${localDay(measuredAt, dto.timeZone)}T00:00:00Z`),
        timeZone: dto.timeZone,
        deviceId: await this.deviceFor(userId, dto.deviceId),
        ...values,
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
      // as últimas pesagens, para o cartão de médias
      recent: [...last90]
        .sort((a, b) => b.measuredAt.getTime() - a.measuredAt.getTime())
        .slice(0, RECENT)
        .map((entry) => ({ day: dayOf(entry), value: entry.weightKg })),
    };
  }

  /**
   * O dashboard: as médias do período e as pesagens, da mais recente para a
   * mais antiga, cada uma com a diferença de peso para a anterior.
   */
  async weight(userId: string, days: number) {
    const latest = await this.latestDay(userId, false);
    if (!latest) return { averages: null, entries: [] };

    const entries = await this.prisma.weightEntry.findMany({
      where: {
        userId,
        ...(days > 0
          ? { day: { gt: new Date(latest.getTime() - days * DAY_MS) } }
          : {}),
      },
      include: { device: true },
    });
    entries.sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime());

    const averages = weightAverages(entries);
    return {
      averages: averages.entries ? averages : null,
      entries: entries
        .map((entry, index) => toView(entry, entries.slice(0, index)))
        .reverse(),
    };
  }

  /** O aparelho da pesagem: o pedido, o predefinido se não vier, ou nenhum. */
  private async deviceFor(userId: string, deviceId: string | null | undefined) {
    if (deviceId === null) return null;
    const device = await this.prisma.measurementDevice.findFirst({
      where: deviceId ? { id: deviceId, userId } : { userId, isDefault: true },
      select: { id: true },
    });
    if (deviceId && !device)
      throw new NotFoundException('Aparelho não encontrado');
    return device?.id ?? null;
  }

  private async latestDay(userId: string, withWeight = true) {
    const latest = await this.prisma.weightEntry.findFirst({
      where: { userId, ...(withWeight ? { weightKg: { not: null } } : {}) },
      orderBy: { measuredAt: 'desc' },
      select: { day: true },
    });
    return latest?.day ?? null;
  }

  private entriesSince(userId: string, latest: Date, days: number) {
    return this.prisma.weightEntry.findMany({
      where: {
        userId,
        weightKg: { not: null },
        day: { gt: new Date(latest.getTime() - days * DAY_MS) },
      },
    });
  }
}

const toView = (entry: EntryWithDevice, earlier: WeightEntry[]) => {
  const previous = earlier.findLast((item) => item.weightKg != null);
  return {
    id: entry.id,
    day: dayOf(entry),
    measuredAt: entry.measuredAt,
    timeZone: entry.timeZone,
    device: entry.device?.name ?? null,
    weightKg: entry.weightKg,
    changeKg:
      entry.weightKg != null && previous?.weightKg != null
        ? roundTo(entry.weightKg - previous.weightKg, 1)
        : null,
    ...(Object.fromEntries(
      COMPOSITION_FIELDS.map((field) => [field, entry[field]]),
    ) as Record<CompositionField, number | null>),
  };
};
