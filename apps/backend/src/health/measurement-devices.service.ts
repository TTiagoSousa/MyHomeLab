import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SaveDeviceDto } from './dto/save-device.dto';

/**
 * Os aparelhos das pesagens (balanças). Há no máximo um predefinido; o primeiro
 * que se cria fica predefinido.
 */
@Injectable()
export class MeasurementDevicesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.measurementDevice.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, isDefault: true },
    });
  }

  async create(userId: string, dto: SaveDeviceDto) {
    const name = dto.name.trim();
    await this.ensureFreeName(userId, name);
    const count = await this.prisma.measurementDevice.count({
      where: { userId },
    });
    const isDefault = dto.isDefault === true || count === 0;
    await this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.measurementDevice.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }
      await tx.measurementDevice.create({ data: { userId, name, isDefault } });
    });
    return this.list(userId);
  }

  async update(userId: string, id: string, dto: Partial<SaveDeviceDto>) {
    await this.find(userId, id);
    const name = dto.name?.trim();
    if (name) await this.ensureFreeName(userId, name, id);
    await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.measurementDevice.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }
      await tx.measurementDevice.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        },
      });
    });
    return this.list(userId);
  }

  /** As pesagens do aparelho ficam, só sem aparelho. */
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
