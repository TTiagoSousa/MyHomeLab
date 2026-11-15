import { NotFoundException } from '@nestjs/common';
import { CategoryRepository } from '../repositories/category-repository';

export async function findCategory(id: string, userId: string, repository: CategoryRepository) {
  const category = await repository.findById(id);
  if (!category || category.userId !== userId) throw new NotFoundException('Categoria não encontrada');
  return category;
}
