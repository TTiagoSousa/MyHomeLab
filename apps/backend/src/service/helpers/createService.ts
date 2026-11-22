import { NotFoundException } from '@nestjs/common';
import { PrismaServiceRepository } from '../repositories/prisma/prisma-service-repository';
import { PrismaCategoryRepository } from 'src/category/repositories/prisma/prisma-category-repository';
import { CreateServiceDto } from '../dto/create-service.dto';
import { ServiceHosting } from 'src/generated/prisma/client/client';

export async function createService(
  dto: CreateServiceDto,
  userId: string,
  serviceRepository: PrismaServiceRepository,
  categoryRepository: PrismaCategoryRepository,
) {
  const category = await categoryRepository.findById(dto.categoryId);
  if (!category || category.userId !== userId)
    throw new NotFoundException('Categoria não encontrada');

  const order = await serviceRepository.countByCategory(dto.categoryId);

  return serviceRepository.create({
    name: dto.name,
    link: dto.link,
    abbreviation: dto.abbreviation,
    color: dto.color,
    isFavorite: dto.isFavorite ?? false,
    hosting: dto.hosting ?? ServiceHosting.SELF_HOSTED,
    categoryId: dto.categoryId,
    userId,
    order,
  });
}
