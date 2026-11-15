import { BadRequestException } from '@nestjs/common';
import { PrismaCategoryRepository } from '../repositories/prisma/prisma-category-repository';
import { ReorderCategoryDto } from '../dto/reorder-category.dto';

export async function reorderCategories(
  dto: ReorderCategoryDto,
  userId: string,
  categoryRepository: PrismaCategoryRepository,
) {
  const categories = await categoryRepository.findAllByUser(userId);

  const ownedIds = new Set(categories.map((category) => category.id));
  const sameSize = dto.orderedIds.length === categories.length;
  const allOwned = dto.orderedIds.every((id) => ownedIds.has(id));

  if (!sameSize || !allOwned) {
    throw new BadRequestException('Lista de categorias inválida');
  }

  await categoryRepository.reorder(userId, dto.orderedIds);

  return categoryRepository.findAllByUser(userId);
}
