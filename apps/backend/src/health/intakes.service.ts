import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { IntakeEntry, IntakeItem } from 'src/generated/prisma/client/client';
import {
  SaveIntakeDto,
  SaveIntakeItemDto,
  SaveIntakeSettingsDto,
} from './dto/save-health-logs.dto';
import { dayOf } from './helpers/dayOf';
import { localDayDate } from './helpers/localDayDate';
import { roundTo } from './helpers/readings';
import { intakeDays } from './helpers/intakeDays';
import {
  INTAKE_PRESET_BY_ID,
  INTAKE_PRESETS,
  STANDARD_DRINK_G,
} from './helpers/intakePresets';

const DAY_MS = 24 * 60 * 60 * 1000;

/** O limite de cafeína habitual para adultos saudáveis (EFSA), por omissão. */
const DEFAULT_CAFFEINE_LIMIT_MG = 400;

/** O limite de bebidas padrão por semana usado por omissão. */
const DEFAULT_ALCOHOL_LIMIT_WEEK = 10;

type Dose = Pick<
  IntakeItem,
  'kind' | 'name' | 'volumeMl' | 'caffeineMg' | 'alcoholG'
>;

const toEntryView = (entry: IntakeEntry) => ({
  id: entry.id,
  at: entry.at,
  day: dayOf(entry.day),
  timeZone: entry.timeZone,
  kind: entry.kind,
  name: entry.name,
  presetId: entry.presetId,
  itemId: entry.itemId,
  quantity: entry.quantity,
  volumeMl: entry.volumeMl,
  caffeineMg: entry.caffeineMg,
  alcoholG: entry.alcoholG,
  drinks:
    entry.alcoholG != null
      ? roundTo(entry.alcoholG / STANDARD_DRINK_G, 1)
      : null,
  amount: entry.amount,
  unit: entry.unit,
  notes: entry.notes,
});

const toItemView = (item: IntakeItem) => ({
  id: item.id,
  kind: item.kind,
  name: item.name,
  volumeMl: item.volumeMl,
  caffeineMg: item.caffeineMg,
  alcoholG: item.alcoholG,
  amount: item.amount,
  unit: item.unit,
});

const times = (value: number | null, quantity: number, digits = 1) =>
  value == null ? null : roundTo(value * quantity, digits);

/**
 * Café, álcool e suplementos: os registos (com editar e apagar), os
 * predefinidos do site, os itens próprios e os limites. Os períodos contam a
 * partir de hoje.
 */
@Injectable()
export class IntakesService {
  constructor(private readonly prisma: PrismaService) {}

  async intakes(userId: string, days: number) {
    const since =
      days > 0 ? { at: { gte: new Date(Date.now() - days * DAY_MS) } } : {};
    const [entries, items, settings] = await Promise.all([
      this.prisma.intakeEntry.findMany({
        where: { userId, ...since },
        orderBy: { at: 'desc' },
      }),
      this.prisma.intakeItem.findMany({
        where: { userId },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.intakeSettings.findUnique({ where: { userId } }),
    ]);
    const perDay = intakeDays(entries);
    const average = (values: number[]) =>
      values.length
        ? roundTo(
            values.reduce((sum, value) => sum + value, 0) / values.length,
            1,
          )
        : null;
    const counted = days > 0 ? days : Math.max(perDay.length, 1);
    const sum = (pick: (day: (typeof perDay)[number]) => number) =>
      perDay.reduce((total, day) => total + pick(day), 0);

    return {
      entries: entries.map(toEntryView),
      days: perDay,
      averages: {
        caffeineMg: roundTo(sum((day) => day.caffeineMg) / counted, 0),
        coffees: roundTo(sum((day) => day.coffees) / counted, 1),
        drinksPerWeek: roundTo((sum((day) => day.drinks) / counted) * 7, 1),
        caffeineDays: average(
          perDay
            .filter((day) => day.caffeineMg > 0)
            .map((day) => day.caffeineMg),
        ),
        alcoholFreeDays:
          days > 0
            ? days - perDay.filter((day) => day.alcoholG > 0).length
            : null,
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      presets: INTAKE_PRESETS.map(({ aliases, ...preset }) => preset),
      items: items.map(toItemView),
      settings: {
        caffeineLimitMg: settings?.caffeineLimitMg ?? DEFAULT_CAFFEINE_LIMIT_MG,
        alcoholLimitWeek:
          settings?.alcoholLimitWeek ?? DEFAULT_ALCOHOL_LIMIT_WEEK,
        hiddenPresets: settings?.hiddenPresets ?? [],
      },
    };
  }

  async create(userId: string, dto: SaveIntakeDto) {
    const data = await this.entryData(userId, dto);
    const entry = await this.prisma.intakeEntry.create({
      data: { userId, ...data },
    });
    return toEntryView(entry);
  }

  async update(userId: string, id: string, dto: SaveIntakeDto) {
    await this.findEntry(userId, id);
    const entry = await this.prisma.intakeEntry.update({
      where: { id },
      data: await this.entryData(userId, dto),
    });
    return toEntryView(entry);
  }

  async remove(userId: string, id: string) {
    await this.findEntry(userId, id);
    await this.prisma.intakeEntry.delete({ where: { id } });
    return { deleted: true };
  }

  async createItem(userId: string, dto: SaveIntakeItemDto) {
    const last = await this.prisma.intakeItem.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const item = await this.prisma.intakeItem.create({
      data: {
        userId,
        position: (last?.position ?? 0) + 1,
        ...this.itemData(dto),
      },
    });
    return toItemView(item);
  }

  async updateItem(userId: string, id: string, dto: SaveIntakeItemDto) {
    await this.findItem(userId, id);
    const item = await this.prisma.intakeItem.update({
      where: { id },
      data: this.itemData(dto),
    });
    return toItemView(item);
  }

  /** Apaga o item; os registos feitos com ele ficam, com os valores que tinham. */
  async removeItem(userId: string, id: string) {
    await this.findItem(userId, id);
    await this.prisma.intakeItem.delete({ where: { id } });
    return { deleted: true };
  }

  async saveSettings(userId: string, dto: SaveIntakeSettingsDto) {
    const data = {
      ...(dto.caffeineLimitMg !== undefined
        ? { caffeineLimitMg: dto.caffeineLimitMg }
        : {}),
      ...(dto.alcoholLimitWeek !== undefined
        ? { alcoholLimitWeek: dto.alcoholLimitWeek }
        : {}),
      ...(dto.hiddenPresets !== undefined
        ? {
            hiddenPresets: dto.hiddenPresets.filter((id) =>
              INTAKE_PRESET_BY_ID.has(id),
            ),
          }
        : {}),
    };
    const settings = await this.prisma.intakeSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return {
      caffeineLimitMg: settings.caffeineLimitMg ?? DEFAULT_CAFFEINE_LIMIT_MG,
      alcoholLimitWeek: settings.alcoholLimitWeek ?? DEFAULT_ALCOHOL_LIMIT_WEEK,
      hiddenPresets: settings.hiddenPresets,
    };
  }

  /**
   * Os campos de um registo. A dose vem do predefinido, do item próprio ou do
   * próprio formulário; os totais que vierem no formulário ganham aos
   * calculados.
   */
  private async entryData(userId: string, dto: SaveIntakeDto) {
    const quantity = dto.quantity ?? 1;
    let dose: Dose | null = null;
    let presetId: string | null = null;
    let itemId: string | null = null;

    if (dto.presetId) {
      const preset = INTAKE_PRESET_BY_ID.get(dto.presetId);
      if (!preset) {
        throw new BadRequestException({
          code: 'HEALTH_INTAKE_PRESET',
          message: 'Esse consumo predefinido não existe.',
        });
      }
      dose = preset;
      presetId = preset.id;
    } else if (dto.itemId) {
      dose = await this.findItem(userId, dto.itemId);
      itemId = dto.itemId;
    }

    const kind = dto.kind ?? dose?.kind;
    const name = dto.name?.trim() || dose?.name;
    if (!kind || !name) {
      throw new BadRequestException({
        code: 'HEALTH_INTAKE_EMPTY',
        message:
          'Indica o que tomaste (um predefinido, um item teu ou o nome e o tipo).',
      });
    }

    const pick = (field: 'volumeMl' | 'caffeineMg' | 'alcoholG') =>
      dto[field] !== undefined
        ? dto[field]
        : times(dose?.[field] ?? null, quantity, field === 'volumeMl' ? 0 : 1);
    const at = new Date(dto.at);
    return {
      at,
      day: localDayDate(at, dto.timeZone),
      timeZone: dto.timeZone,
      kind,
      name,
      presetId,
      itemId,
      quantity,
      volumeMl: pick('volumeMl'),
      caffeineMg: kind === 'CAFFEINE' ? pick('caffeineMg') : null,
      alcoholG: kind === 'ALCOHOL' ? pick('alcoholG') : null,
      notes: dto.notes?.trim() || null,
    };
  }

  private itemData(dto: SaveIntakeItemDto) {
    return {
      kind: dto.kind,
      name: dto.name.trim(),
      volumeMl: dto.volumeMl ?? null,
      caffeineMg: dto.kind === 'CAFFEINE' ? (dto.caffeineMg ?? null) : null,
      alcoholG: dto.kind === 'ALCOHOL' ? (dto.alcoholG ?? null) : null,
    };
  }

  private async findEntry(userId: string, id: string) {
    const entry = await this.prisma.intakeEntry.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!entry) throw new NotFoundException('Registo não encontrado');
  }

  private async findItem(userId: string, id: string) {
    const item = await this.prisma.intakeItem.findFirst({
      where: { id, userId },
    });
    if (!item) throw new NotFoundException('Item não encontrado');
    return item;
  }
}
