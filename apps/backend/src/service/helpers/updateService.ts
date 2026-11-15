import { NotFoundException } from '@nestjs/common';
import { PrismaServiceRepository } from '../repositories/prisma/prisma-service-repository';
import { PrismaCategoryRepository } from 'src/category/repositories/prisma/prisma-category-repository';
import { UpdateServiceDto } from '../dto/update-service.dto';
import { findService } from './findService';

export async function updateService(
  id: string,
  dto: UpdateServiceDto,
  userId: string,
  serviceRepository: PrismaServiceRepository,
  categoryRepository: PrismaCategoryRepository,
) {
  const existing = await findService(id, userId, serviceRepository);
  const newCategoryId = dto.categoryId;
  const isMovingCategory = !!newCategoryId && newCategoryId !== existing.categoryId;

  if (!isMovingCategory) {
    return serviceRepository.update(id, dto);
  }

  const category = await categoryRepository.findById(newCategoryId);
  if (!category || category.userId !== userId) throw new NotFoundException('Categoria não encontrada');

  const newOrder = await serviceRepository.countByCategory(newCategoryId);
  const updated = await serviceRepository.update(id, { ...dto, order: newOrder });
  await serviceRepository.decrementOrderAfter(existing.categoryId, existing.order);

  return updated;
}
