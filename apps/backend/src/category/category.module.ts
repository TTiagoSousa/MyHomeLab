import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { PrismaCategoryRepository } from './repositories/prisma/prisma-category-repository';

@Module({
  controllers: [CategoryController],
  providers: [
    CategoryService,
    {
      provide: PrismaCategoryRepository,
      useClass: PrismaCategoryRepository,
    },
  ],
  exports: [PrismaCategoryRepository],
})
export class CategoryModule {}
