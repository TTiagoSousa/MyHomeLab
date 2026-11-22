import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CategoryRepository,
  CategoryWithServices,
} from '../category-repository';
import { Category } from 'src/generated/prisma/client/client';

@Injectable()
export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Category | null> {
    return this.prisma.category.findUnique({ where: { id } });
  }

  async findByUserAndName(
    userId: string,
    name: string,
  ): Promise<Category | null> {
    return this.prisma.category.findUnique({
      where: { userId_name: { userId, name } },
    });
  }

  async findAllByUser(userId: string): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
    });
  }

  async findAllByUserWithServices(
    userId: string,
  ): Promise<CategoryWithServices[]> {
    return this.prisma.category.findMany({
      where: { userId },
      include: { services: { orderBy: { order: 'asc' } } },
      orderBy: { order: 'asc' },
    });
  }

  async countByUser(userId: string): Promise<number> {
    return this.prisma.category.count({ where: { userId } });
  }

  async create(data: {
    name: string;
    userId: string;
    order: number;
  }): Promise<Category> {
    return this.prisma.category.create({ data });
  }

  async update(id: string, data: { name?: string }): Promise<Category> {
    return this.prisma.category.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.category.delete({ where: { id } });
  }

  async decrementOrderAfter(userId: string, order: number): Promise<void> {
    await this.prisma.category.updateMany({
      where: { userId, order: { gt: order } },
      data: { order: { decrement: 1 } },
    });
  }

  async reorder(userId: string, orderedIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.category.updateMany({
          where: { id, userId },
          data: { order: index },
        }),
      ),
    );
  }
}
