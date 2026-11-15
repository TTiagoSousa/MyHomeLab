import { ConflictException } from '@nestjs/common';
import { PrismaCategoryRepository } from '../repositories/prisma/prisma-category-repository';
import { CreateCategoryDto } from '../dto/create-category.dto';

export async function createCategory(
  dto: CreateCategoryDto,
  userId: string,
  categoryRepository: PrismaCategoryRepository,
) {
  const exists = await categoryRepository.findByUserAndName(userId, dto.name);
  if (exists) throw new ConflictException('Categoria já existe');

  const order = await categoryRepository.countByUser(userId);

  return categoryRepository.create({ name: dto.name, userId, order });
}
