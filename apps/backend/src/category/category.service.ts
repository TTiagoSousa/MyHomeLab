import { Injectable } from '@nestjs/common';
import { PrismaCategoryRepository } from './repositories/prisma/prisma-category-repository';
import { createCategory } from './helpers/createCategory';
import { updateCategory } from './helpers/updateCategory';
import { deleteCategory } from './helpers/deleteCategory';
import { findAllCategories } from './helpers/findAllCategories';
import { findAllCategoriesWithServices } from './helpers/findAllCategoriesWithServices';
import { findCategory } from './helpers/findCategory';
import { reorderCategories } from './helpers/reorderCategories';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReorderCategoryDto } from './dto/reorder-category.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly categoryRepository: PrismaCategoryRepository) {}

  async create(dto: CreateCategoryDto, userId: string) {
    return createCategory(dto, userId, this.categoryRepository);
  }

  async findAll(userId: string) {
    return findAllCategories(userId, this.categoryRepository);
  }

  async findAllWithServices(userId: string) {
    return findAllCategoriesWithServices(userId, this.categoryRepository);
  }

  async findOne(id: string, userId: string) {
    return findCategory(id, userId, this.categoryRepository);
  }

  async update(id: string, dto: UpdateCategoryDto, userId: string) {
    return updateCategory(id, dto, userId, this.categoryRepository);
  }

  async remove(id: string, userId: string) {
    return deleteCategory(id, userId, this.categoryRepository);
  }

  async reorder(dto: ReorderCategoryDto, userId: string) {
    return reorderCategories(dto, userId, this.categoryRepository);
  }
}
