import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  BodyMeasurement,
  VitalReading,
} from 'src/generated/prisma/client/client';
import {
  SaveBodyMeasurementDto,
  SaveProgressPhotoDto,
  SaveVitalDto,
} from './dto/save-health-logs.dto';
import { localDayDate } from './helpers/localDayDate';
import { dateOnly } from './helpers/dateOnly';
import { dayOf } from './helpers/dayOf';
import { BODY_FIELDS, type BodyField } from './helpers/healthMetrics';

const DAY_MS = 24 * 60 * 60 * 1000;

const IMAGE_TYPES = /^image\/(jpeg|png|webp)$/;

const toMeasurementView = (measurement: BodyMeasurement) => ({
  id: measurement.id,
  day: dayOf(measurement.day),
  waistCm: measurement.waistCm,
  chestCm: measurement.chestCm,
  armCm: measurement.armCm,
  thighCm: measurement.thighCm,
  hipsCm: measurement.hipsCm,
  neckCm: measurement.neckCm,
  notes: measurement.notes,
});

const toVitalView = (vital: VitalReading) => ({
  id: vital.id,
  at: vital.at,
  day: dayOf(vital.day),
  timeZone: vital.timeZone,
  kind: vital.kind,
  value: vital.value,
  value2: vital.value2,
  pulse: vital.pulse,
  context: vital.context,
  notes: vital.notes,
});

/**
 * O corpo, registado à mão: medidas (cintura, braço…; a composição corporal vai nas pesagens),
 * fotos de progresso e medições (tensão arterial, glicemia, temperatura).
 */
@Injectable()
export class BodyService {
  constructor(private readonly prisma: PrismaService) {}

  /** As medidas e as fotos são poucas e vêm todas; as medições, as do período. */
  async body(userId: string, days: number) {
    const [measurements, photos, vitals] = await Promise.all([
      this.prisma.bodyMeasurement.findMany({
        where: { userId },
        orderBy: { day: 'desc' },
      }),
      this.prisma.progressPhoto.findMany({
        where: { userId },
        orderBy: [{ day: 'desc' }, { pose: 'asc' }],
        select: { id: true, day: true, pose: true, notes: true },
      }),
      this.prisma.vitalReading.findMany({
        where: {
          userId,
          ...(days > 0
            ? { at: { gte: new Date(Date.now() - days * DAY_MS) } }
            : {}),
        },
        orderBy: { at: 'desc' },
      }),
    ]);
    return {
      measurements: measurements.map(toMeasurementView),
      photos: photos.map((photo) => ({ ...photo, day: dayOf(photo.day) })),
      vitals: vitals.map(toVitalView),
    };
  }

  /**
   * Junta medidas a um dia sem apagar as que lá estão (os formulários rápidos
   * só mandam os campos que têm).
   */
  async mergeMeasurement(
    userId: string,
    day: Date,
    values: Partial<Record<BodyField, number>>,
  ) {
    await this.prisma.bodyMeasurement.upsert({
      where: { userId_day: { userId, day } },
      create: { userId, day, ...values },
      update: values,
    });
  }

  /** Uma linha por dia: voltar a guardar o mesmo dia substitui-a. */
  async saveMeasurement(userId: string, dto: SaveBodyMeasurementDto) {
    const day = dateOnly(dto.day)!;
    const values = Object.fromEntries(
      BODY_FIELDS.map((field) => [field, dto[field] ?? null]),
    );
    if (Object.values(values).every((value) => value == null)) {
      throw new BadRequestException({
        code: 'HEALTH_BODY_EMPTY',
        message: 'Mete pelo menos uma medida.',
      });
    }
    const data = { ...values, notes: dto.notes?.trim() || null };
    const measurement = await this.prisma.bodyMeasurement.upsert({
      where: { userId_day: { userId, day } },
      create: { userId, day, ...data },
      update: data,
    });
    return toMeasurementView(measurement);
  }

  async removeMeasurement(userId: string, id: string) {
    const { count } = await this.prisma.bodyMeasurement.deleteMany({
      where: { id, userId },
    });
    if (!count) throw new NotFoundException('Medidas não encontradas');
    return { deleted: true };
  }

  async addPhoto(
    userId: string,
    dto: SaveProgressPhotoDto,
    file?: { buffer: Buffer; mimetype: string },
  ) {
    if (!file?.buffer?.length || !IMAGE_TYPES.test(file.mimetype)) {
      throw new BadRequestException({
        code: 'HEALTH_IMAGE_TYPE',
        message: 'A foto tem de ser JPG, PNG ou WebP.',
      });
    }
    const photo = await this.prisma.progressPhoto.create({
      data: {
        userId,
        day: dateOnly(dto.day)!,
        pose: dto.pose,
        image: new Uint8Array(file.buffer),
        mime: file.mimetype,
        notes: dto.notes?.trim() || null,
      },
      select: { id: true, day: true, pose: true, notes: true },
    });
    return { ...photo, day: dayOf(photo.day) };
  }

  async photo(userId: string, id: string) {
    const photo = await this.prisma.progressPhoto.findFirst({
      where: { id, userId },
      select: { image: true, mime: true },
    });
    if (!photo) throw new NotFoundException('Foto não encontrada');
    return { buffer: Buffer.from(photo.image), mime: photo.mime };
  }

  async removePhoto(userId: string, id: string) {
    const { count } = await this.prisma.progressPhoto.deleteMany({
      where: { id, userId },
    });
    if (!count) throw new NotFoundException('Foto não encontrada');
    return { deleted: true };
  }

  async createVital(userId: string, dto: SaveVitalDto) {
    if (dto.kind === 'BLOOD_PRESSURE' && dto.value2 == null) {
      throw new BadRequestException({
        code: 'HEALTH_VITAL_DIASTOLIC',
        message: 'Mete a tensão mínima (diastólica).',
      });
    }
    const at = new Date(dto.at);
    const vital = await this.prisma.vitalReading.create({
      data: {
        userId,
        at,
        day: localDayDate(at, dto.timeZone),
        timeZone: dto.timeZone,
        kind: dto.kind,
        value: dto.value,
        value2: dto.kind === 'BLOOD_PRESSURE' ? (dto.value2 ?? null) : null,
        pulse: dto.kind === 'BLOOD_PRESSURE' ? (dto.pulse ?? null) : null,
        context: dto.kind === 'GLUCOSE' ? (dto.context ?? null) : null,
        notes: dto.notes?.trim() || null,
      },
    });
    return toVitalView(vital);
  }

  async removeVital(userId: string, id: string) {
    const { count } = await this.prisma.vitalReading.deleteMany({
      where: { id, userId },
    });
    if (!count) throw new NotFoundException('Medição não encontrada');
    return { deleted: true };
  }
}
