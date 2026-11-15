import { ConflictException } from '@nestjs/common';
import { PrismaCategoryRepository } from '../repositories/prisma/prisma-category-repository';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { findCategory } from './findCategory';

export async function updateCategory(
  id: string,
  dto: UpdateCategoryDto,
  userId: string,
  categoryRepository: PrismaCategoryRepository,
) {
  await findCategory(id, userId, categoryRepository);

  if (dto.name) {
    const exists = await categoryRepository.findByUserAndName(userId, dto.name);
    if (exists && exists.id !== id) throw new ConflictException('Categoria já existe');
  }

  return categoryRepository.update(id, dto);
}
