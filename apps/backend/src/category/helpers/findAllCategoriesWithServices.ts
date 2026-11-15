import { PrismaCategoryRepository } from '../repositories/prisma/prisma-category-repository';

export async function findAllCategoriesWithServices(
  userId: string,
  categoryRepository: PrismaCategoryRepository,
) {
  const categories = await categoryRepository.findAllByUserWithServices(userId);

  return categories.map((category) => ({
    ...category,
    servicesCount: category.services.length,
  }));
}
