import { Injectable } from '@nestjs/common';
import { PrismaServiceRepository } from './repositories/prisma/prisma-service-repository';
import { PrismaCategoryRepository } from 'src/category/repositories/prisma/prisma-category-repository';
import { createService } from './helpers/createService';
import { updateService } from './helpers/updateService';
import { deleteService } from './helpers/deleteService';
import { findAllServices } from './helpers/findAllServices';
import { findService } from './helpers/findService';
import { reorderServices } from './helpers/reorderServices';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ReorderServiceDto } from './dto/reorder-service.dto';

@Injectable()
export class ServiceService {
  constructor(
    private readonly serviceRepository: PrismaServiceRepository,
    private readonly categoryRepository: PrismaCategoryRepository,
  ) {}

  async create(dto: CreateServiceDto, userId: string) {
    return createService(
      dto,
      userId,
      this.serviceRepository,
      this.categoryRepository,
    );
  }

  async findAll(userId: string) {
    return findAllServices(userId, this.serviceRepository);
  }

  async findOne(id: string, userId: string) {
    return findService(id, userId, this.serviceRepository);
  }

  async update(id: string, dto: UpdateServiceDto, userId: string) {
    return updateService(
      id,
      dto,
      userId,
      this.serviceRepository,
      this.categoryRepository,
    );
  }

  async remove(id: string, userId: string) {
    return deleteService(id, userId, this.serviceRepository);
  }

  async reorder(dto: ReorderServiceDto, userId: string) {
    return reorderServices(
      dto,
      userId,
      this.serviceRepository,
      this.categoryRepository,
    );
  }
}
