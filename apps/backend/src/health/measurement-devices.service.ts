import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MeasurementDeviceKind } from 'src/generated/prisma/client/client';
import { SaveDeviceDto, UpdateDeviceDto } from './dto/save-device.dto';
import { DEVICE_KINDS } from './helpers/healthMetrics';

const DEVICE_SELECT = {
  id: true,
  kind: true,
  name: true,
  brand: true,
  model: true,
  notes: true,
  isDefault: true,
} as const;

const textOrNull = (value: string | null | undefined) =>
  value === undefined ? undefined : value?.trim() || null;

/**
 * Os aparelhos de medição (balanças, medidores de tensão…). Há no máximo um
 * predefinido por tipo; o primeiro de cada tipo fica predefinido.
 */
@Injectable()
export class MeasurementDevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const devices = await this.prisma.measurementDevice.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: DEVICE_SELECT,
    });
    // pela ordem dos tipos, para a página dos aparelhos agrupar
    return devices.sort(
      (a, b) => DEVICE_KINDS.indexOf(a.kind) - DEVICE_KINDS.indexOf(b.kind),
    );
  }

  async create(userId: string, dto: SaveDeviceDto) {
    const name = dto.name.trim();
    const kind: MeasurementDeviceKind = dto.kind ?? 'SCALE';
    await this.ensureFreeName(userId, name);
    const sameKind = await this.prisma.measurementDevice.count({
      where: { userId, kind },
    });
    const isDefault = dto.isDefault === true || sameKind === 0;
    await this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.measurementDevice.updateMany({
          where: { userId, kind },
          data: { isDefault: false },
        });
      }
      await tx.measurementDevice.create({
        data: {
          userId,
          kind,
          name,
          brand: textOrNull(dto.brand),
          model: textOrNull(dto.model),
          notes: textOrNull(dto.notes),
          isDefault,
        },
      });
    });
    return this.list(userId);
  }

  async update(userId: string, id: string, dto: UpdateDeviceDto) {
    const device = await this.find(userId, id);
    const name = dto.name?.trim();
    if (name) await this.ensureFreeName(userId, name, id);
    await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.measurementDevice.updateMany({
          where: { userId, kind: device.kind },
          data: { isDefault: false },
        });
      }
      await tx.measurementDevice.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          brand: textOrNull(dto.brand),
          model: textOrNull(dto.model),
          notes: textOrNull(dto.notes),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        },
      });
    });
    return this.list(userId);
  }

  /** Os registos do aparelho ficam, só sem aparelho. */
  async remove(userId: string, id: string) {
    await this.find(userId, id);
    await this.prisma.measurementDevice.delete({ where: { id } });
    return this.list(userId);
  }

  private async find(userId: string, id: string) {
    const device = await this.prisma.measurementDevice.findFirst({
      where: { id, userId },
    });
    if (!device) throw new NotFoundException('Aparelho não encontrado');
    return device;
  }

  private async ensureFreeName(
    userId: string,
    name: string,
    exceptId?: string,
  ) {
    const taken = await this.prisma.measurementDevice.findFirst({
      where: {
        userId,
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
    if (taken)
      throw new ConflictException('Já tens um aparelho com esse nome.');
  }
}
