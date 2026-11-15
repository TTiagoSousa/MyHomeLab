import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  HealthCondition,
  HealthDiaryEntry,
  Medication,
} from 'src/generated/prisma/client/client';
import {
  ALLERGY_AREAS,
  BODY_AREAS,
  CONDITION_STATUSES,
  SaveDiaryEntryDto,
  SaveHealthConditionDto,
  SaveHealthProfileDto,
  SaveMedicationDto,
} from './dto/save-health-records.dto';
import { localDay } from './helpers/timeZone';
import { roundTo } from './helpers/readings';
import { ageOn } from './helpers/ageOn';

const DAY_MS = 24 * 60 * 60 * 1000;

const dayOf = (date: Date | null) =>
  date ? date.toISOString().slice(0, 10) : null;

const dateOnly = (value?: string | null) =>
  value ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : null;

type ConditionLink = Pick<HealthCondition, 'id' | 'kind' | 'name'>;

const MEDICATION_INCLUDE = {
  condition: { select: { id: true, kind: true, name: true } },
} as const;

const toMedicationView = (
  medication: Medication & { condition?: ConditionLink | null },
) => {
  const today = new Date().toISOString().slice(0, 10);
  const endDate = dayOf(medication.endDate);
  return {
    id: medication.id,
    kind: medication.kind,
    name: medication.name,
    brand: medication.brand,
    substance: medication.substance,
    doseAmount: medication.doseAmount,
    doseUnit: medication.doseUnit,
    timesPerDay: medication.timesPerDay,
    times: medication.times,
    startDate: dayOf(medication.startDate),
    endDate,
    notes: medication.notes,
    active: !endDate || endDate > today,
    condition: medication.condition ?? null,
  };
};

const toConditionView = (
  condition: HealthCondition & {
    medications: Pick<Medication, 'id' | 'name' | 'endDate'>[];
  },
) => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: condition.id,
    kind: condition.kind,
    name: condition.name,
    status: condition.status,
    severity: condition.severity,
    since: dayOf(condition.since),
    resolvedAt: dayOf(condition.resolvedAt),
    reaction: condition.reaction,
    treatment: condition.treatment,
    notes: condition.notes,
    medications: condition.medications.map((medication) => {
      const endDate = dayOf(medication.endDate);
      return {
        id: medication.id,
        name: medication.name,
        active: !endDate || endDate > today,
      };
    }),
  };
};

const CONDITION_INCLUDE = {
  medications: {
    select: { id: true, name: true, endDate: true },
    orderBy: { name: 'asc' },
  },
} as const;

/** As ativas primeiro, as tratadas no fim. */
const statusRank = (status: string) =>
  CONDITION_STATUSES.indexOf(status as (typeof CONDITION_STATUSES)[number]);

const toDiaryView = (entry: HealthDiaryEntry) => ({
  id: entry.id,
  at: entry.at,
  day: dayOf(entry.day),
  timeZone: entry.timeZone,
  kind: entry.kind,
  bodyArea: entry.bodyArea,
  intensity: entry.intensity,
  trigger: entry.trigger,
  text: entry.text,
});

/** Os tipos que precisam de texto: a nota e o registo do dia. */
const TEXT_KINDS = ['NOTE', 'DAY'];

const AREAS_OF: Record<string, readonly string[]> = {
  PAIN: BODY_AREAS,
  ALLERGY: ALLERGY_AREAS,
};

const NOT_FOUND = {
  medication: 'Medicamento não encontrado',
  diary: 'Entrada do diário não encontrada',
  condition: 'Alergia ou doença não encontrada',
};

const PROFILE_TEXTS = ['fullName', 'emergencyContact', 'notes'] as const;

/**
 * O que se regista à mão além das métricas: o perfil (dados pessoais e altura),
 * as alergias e doenças crónicas, a medicação (que pode ligar-se a uma delas)
 * e o diário de saúde (dores, sintomas, alergias, o dia e notas).
 */
@Injectable()
export class HealthRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Os dados pessoais, a idade, a altura e o IMC com a pesagem mais recente. */
  async profile(userId: string) {
    const [profile, weight] = await Promise.all([
      this.prisma.healthProfile.findUnique({ where: { userId } }),
      this.prisma.weightEntry.findFirst({
        where: { userId },
        orderBy: { measuredAt: 'desc' },
        select: { weightKg: true },
      }),
    ]);
    const heightCm = profile?.heightCm ?? null;
    const weightKg = weight?.weightKg ?? null;
    const birthDate = profile?.birthDate ?? null;
    return {
      fullName: profile?.fullName ?? null,
      birthDate: dayOf(birthDate),
      age: birthDate
        ? ageOn(birthDate, new Date().toISOString().slice(0, 10))
        : null,
      sex: profile?.sex ?? null,
      bloodType: profile?.bloodType ?? null,
      emergencyContact: profile?.emergencyContact ?? null,
      notes: profile?.notes ?? null,
      heightCm,
      weightKg,
      bmi:
        heightCm && weightKg
          ? roundTo(weightKg / (heightCm / 100) ** 2, 1)
          : null,
    };
  }

  /** Só muda os campos que vêm no pedido (a página do peso só manda a altura). */
  async saveProfile(userId: string, dto: SaveHealthProfileDto) {
    const data: Record<string, unknown> = {};
    if (dto.heightCm !== undefined) data.heightCm = dto.heightCm;
    if (dto.birthDate !== undefined) data.birthDate = dateOnly(dto.birthDate);
    if (dto.sex !== undefined) data.sex = dto.sex;
    if (dto.bloodType !== undefined) data.bloodType = dto.bloodType;
    for (const field of PROFILE_TEXTS) {
      if (dto[field] !== undefined) data[field] = dto[field]?.trim() || null;
    }
    if (data.birthDate && (data.birthDate as Date) > new Date()) {
      throw new BadRequestException({
        code: 'HEALTH_PROFILE_BIRTH_DATE',
        message: 'A data de nascimento não pode ser no futuro.',
      });
    }
    await this.prisma.healthProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return this.profile(userId);
  }

  /** Os medicamentos: primeiro os que se tomam agora, depois os antigos. */
  async medications(userId: string) {
    const medications = await this.prisma.medication.findMany({
      where: { userId },
      include: MEDICATION_INCLUDE,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
    return medications
      .map(toMedicationView)
      .sort((a, b) => Number(b.active) - Number(a.active));
  }

  async createMedication(userId: string, dto: SaveMedicationDto) {
    const medication = await this.prisma.medication.create({
      data: { userId, ...(await this.medicationData(userId, dto)) },
      include: MEDICATION_INCLUDE,
    });
    return toMedicationView(medication);
  }

  async updateMedication(userId: string, id: string, dto: SaveMedicationDto) {
    await this.findOwned('medication', userId, id);
    const medication = await this.prisma.medication.update({
      where: { id },
      data: await this.medicationData(userId, dto),
      include: MEDICATION_INCLUDE,
    });
    return toMedicationView(medication);
  }

  async removeMedication(userId: string, id: string) {
    await this.findOwned('medication', userId, id);
    await this.prisma.medication.delete({ where: { id } });
    return { deleted: true };
  }

  /** As alergias e doenças, com os medicamentos ligados a cada uma. */
  async conditions(userId: string) {
    const conditions = await this.prisma.healthCondition.findMany({
      where: { userId },
      include: CONDITION_INCLUDE,
      orderBy: [{ since: 'desc' }, { createdAt: 'desc' }],
    });
    return conditions
      .sort((a, b) => statusRank(a.status) - statusRank(b.status))
      .map(toConditionView);
  }

  async createCondition(userId: string, dto: SaveHealthConditionDto) {
    const condition = await this.prisma.healthCondition.create({
      data: { userId, ...this.conditionData(dto) },
      include: CONDITION_INCLUDE,
    });
    return toConditionView(condition);
  }

  async updateCondition(
    userId: string,
    id: string,
    dto: SaveHealthConditionDto,
  ) {
    await this.findOwned('condition', userId, id);
    const condition = await this.prisma.healthCondition.update({
      where: { id },
      data: this.conditionData(dto),
      include: CONDITION_INCLUDE,
    });
    return toConditionView(condition);
  }

  /** Apaga a alergia ou doença; os medicamentos ligados ficam, só sem a ligação. */
  async removeCondition(userId: string, id: string) {
    await this.findOwned('condition', userId, id);
    await this.prisma.healthCondition.delete({ where: { id } });
    return { deleted: true };
  }

  /** O diário de um período, contado a partir de hoje (é um diário, não uma importação). */
  async diary(userId: string, days: number) {
    const entries = await this.prisma.healthDiaryEntry.findMany({
      where: {
        userId,
        ...(days > 0
          ? { at: { gt: new Date(Date.now() - days * DAY_MS) } }
          : {}),
      },
      orderBy: { at: 'desc' },
    });
    return entries.map(toDiaryView);
  }

  async createDiaryEntry(userId: string, dto: SaveDiaryEntryDto) {
    const entry = await this.prisma.healthDiaryEntry.create({
      data: { userId, ...this.diaryData(dto) },
    });
    return toDiaryView(entry);
  }

  async updateDiaryEntry(userId: string, id: string, dto: SaveDiaryEntryDto) {
    await this.findOwned('diary', userId, id);
    const entry = await this.prisma.healthDiaryEntry.update({
      where: { id },
      data: this.diaryData(dto),
    });
    return toDiaryView(entry);
  }

  async removeDiaryEntry(userId: string, id: string) {
    await this.findOwned('diary', userId, id);
    await this.prisma.healthDiaryEntry.delete({ where: { id } });
    return { deleted: true };
  }

  private conditionData(dto: SaveHealthConditionDto) {
    const since = dateOnly(dto.since);
    const resolvedAt =
      dto.status === 'RESOLVED' ? dateOnly(dto.resolvedAt) : null;
    if (since && resolvedAt && resolvedAt < since) {
      throw new BadRequestException({
        code: 'HEALTH_CONDITION_DATES',
        message: 'A data em que ficou tratada é anterior à de início.',
      });
    }
    return {
      kind: dto.kind,
      name: dto.name.trim(),
      status: dto.status,
      severity: dto.severity ?? null,
      since,
      resolvedAt,
      reaction: dto.reaction?.trim() || null,
      treatment: dto.treatment?.trim() || null,
      notes: dto.notes?.trim() || null,
    };
  }

  private async medicationData(userId: string, dto: SaveMedicationDto) {
    if (dto.conditionId) {
      await this.findOwned('condition', userId, dto.conditionId);
    }
    const times = [...new Set(dto.times)].sort();
    const startDate = dateOnly(dto.startDate);
    const endDate = dateOnly(dto.endDate);
    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException({
        code: 'HEALTH_MEDICATION_DATES',
        message: 'A data de fim é anterior à de início.',
      });
    }
    return {
      kind: dto.kind ?? 'MEDICATION',
      name: dto.name.trim(),
      brand: dto.brand?.trim() || null,
      substance: dto.substance?.trim() || null,
      doseAmount: dto.doseAmount ?? null,
      doseUnit: dto.doseUnit ?? null,
      times,
      timesPerDay: times.length || dto.timesPerDay || null,
      startDate,
      endDate,
      notes: dto.notes?.trim() || null,
      conditionId: dto.conditionId ?? null,
    };
  }

  private diaryData(dto: SaveDiaryEntryDto) {
    const at = new Date(dto.at);
    const text = dto.text?.trim() || null;
    if (TEXT_KINDS.includes(dto.kind) && !text) {
      throw new BadRequestException({
        code: 'HEALTH_DIARY_EMPTY',
        message: 'Escreve o texto da entrada.',
      });
    }
    const areas = AREAS_OF[dto.kind];
    const bodyArea =
      areas && dto.bodyArea && areas.includes(dto.bodyArea)
        ? dto.bodyArea
        : null;
    return {
      at,
      day: new Date(`${localDay(at, dto.timeZone)}T00:00:00Z`),
      timeZone: dto.timeZone,
      kind: dto.kind,
      bodyArea,
      intensity: TEXT_KINDS.includes(dto.kind) ? null : (dto.intensity ?? null),
      trigger: dto.kind === 'ALLERGY' ? dto.trigger?.trim() || null : null,
      text,
    };
  }

  private async findOwned(
    model: 'medication' | 'diary' | 'condition',
    userId: string,
    id: string,
  ) {
    const where = { id, userId };
    const select = { id: true };
    const found =
      model === 'medication'
        ? await this.prisma.medication.findFirst({ where, select })
        : model === 'condition'
          ? await this.prisma.healthCondition.findFirst({ where, select })
          : await this.prisma.healthDiaryEntry.findFirst({ where, select });
    if (!found) throw new NotFoundException(NOT_FOUND[model]);
  }
}
