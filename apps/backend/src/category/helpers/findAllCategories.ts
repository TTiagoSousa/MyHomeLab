import { PrismaCategoryRepository } from '../repositories/prisma/prisma-category-repository';

export async function findAllCategories(userId: string, categoryRepository: PrismaCategoryRepository) {
  return categoryRepository.findAllByUser(userId);
}
