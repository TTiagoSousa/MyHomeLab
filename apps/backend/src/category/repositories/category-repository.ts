import { Category, Service } from 'src/generated/prisma/client/client';

export type CategoryWithServices = Category & { services: Service[] };

export interface CategoryRepository {
  findById(id: string): Promise<Category | null>;
  findByUserAndName(userId: string, name: string): Promise<Category | null>;
  findAllByUser(userId: string): Promise<Category[]>;
  findAllByUserWithServices(userId: string): Promise<CategoryWithServices[]>;
  countByUser(userId: string): Promise<number>;
  create(data: {
    name: string;
    userId: string;
    order: number;
  }): Promise<Category>;
  update(id: string, data: { name?: string }): Promise<Category>;
  delete(id: string): Promise<void>;
  decrementOrderAfter(userId: string, order: number): Promise<void>;
  reorder(userId: string, orderedIds: string[]): Promise<void>;
}
