import { PrismaCategoryRepository } from '../repositories/prisma/prisma-category-repository';
import { findCategory } from './findCategory';

export async function deleteCategory(
  id: string,
  userId: string,
  categoryRepository: PrismaCategoryRepository,
) {
  const category = await findCategory(id, userId, categoryRepository);
  await categoryRepository.delete(id);
  await categoryRepository.decrementOrderAfter(userId, category.order);
}
