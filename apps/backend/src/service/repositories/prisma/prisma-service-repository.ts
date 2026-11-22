import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ServiceRepository, ServiceWithCategory } from '../service-repository';
import { ServiceHosting } from 'src/generated/prisma/client/client';

@Injectable()
export class PrismaServiceRepository implements ServiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ServiceWithCategory | null> {
    return this.prisma.service.findUnique({
      where: { id },
      include: { category: true },
    });
  }

  async findAllByUser(userId: string): Promise<ServiceWithCategory[]> {
    return this.prisma.service.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { order: 'asc' },
    });
  }

  async countByCategory(categoryId: string): Promise<number> {
    return this.prisma.service.count({ where: { categoryId } });
  }

  async create(data: {
    name: string;
    link: string;
    abbreviation: string;
    color: string;
    isFavorite: boolean;
    hosting: ServiceHosting;
    categoryId: string;
    userId: string;
    order: number;
  }): Promise<ServiceWithCategory> {
    return this.prisma.service.create({ data, include: { category: true } });
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      link: string;
      abbreviation: string;
      color: string;
      isFavorite: boolean;
      hosting: ServiceHosting;
      categoryId: string;
      order: number;
    }>,
  ): Promise<ServiceWithCategory> {
    return this.prisma.service.update({
      where: { id },
      data,
      include: { category: true },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.service.delete({ where: { id } });
  }

  async decrementOrderAfter(categoryId: string, order: number): Promise<void> {
    await this.prisma.service.updateMany({
      where: { categoryId, order: { gt: order } },
      data: { order: { decrement: 1 } },
    });
  }

  async reorder(
    categoryId: string,
    userId: string,
    orderedIds: string[],
  ): Promise<void> {
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.service.updateMany({
          where: { id, userId, categoryId },
          data: { order: index },
        }),
      ),
    );
  }
}
