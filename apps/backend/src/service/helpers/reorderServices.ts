import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaServiceRepository } from '../repositories/prisma/prisma-service-repository';
import { PrismaCategoryRepository } from 'src/category/repositories/prisma/prisma-category-repository';
import { ReorderServiceDto } from '../dto/reorder-service.dto';

export async function reorderServices(
  dto: ReorderServiceDto,
  userId: string,
  serviceRepository: PrismaServiceRepository,
  categoryRepository: PrismaCategoryRepository,
) {
  const category = await categoryRepository.findById(dto.categoryId);
  if (!category || category.userId !== userId)
    throw new NotFoundException('Categoria não encontrada');

  const services = await serviceRepository.findAllByUser(userId);
  const categoryServiceIds = new Set(
    services
      .filter((service) => service.categoryId === dto.categoryId)
      .map((service) => service.id),
  );

  const sameSize = dto.orderedIds.length === categoryServiceIds.size;
  const allBelong = dto.orderedIds.every((id) => categoryServiceIds.has(id));

  if (!sameSize || !allBelong) {
    throw new BadRequestException('Lista de serviços inválida');
  }

  await serviceRepository.reorder(dto.categoryId, userId, dto.orderedIds);

  return serviceRepository.findAllByUser(userId);
}
