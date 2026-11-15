import {
  Category,
  Service,
  ServiceHosting,
} from 'src/generated/prisma/client/client';

export type ServiceWithCategory = Service & { category: Category };

export interface ServiceRepository {
  findById(id: string): Promise<ServiceWithCategory | null>;
  findAllByUser(userId: string): Promise<ServiceWithCategory[]>;
  countByCategory(categoryId: string): Promise<number>;
  create(data: {
    name: string;
    link: string;
    abbreviation: string;
    color: string;
    isFavorite: boolean;
    hosting: ServiceHosting;
    categoryId: string;
    userId: string;
    order: number;
  }): Promise<ServiceWithCategory>;
  update(
    id: string,
    data: Partial<{
      name: string;
      link: string;
      abbreviation: string;
      color: string;
      isFavorite: boolean;
      hosting: ServiceHosting;
      categoryId: string;
      order: number;
    }>,
  ): Promise<ServiceWithCategory>;
  delete(id: string): Promise<void>;
  decrementOrderAfter(categoryId: string, order: number): Promise<void>;
  reorder(categoryId: string, userId: string, orderedIds: string[]): Promise<void>;
}
