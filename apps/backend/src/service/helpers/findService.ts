import { NotFoundException } from '@nestjs/common';
import { ServiceRepository } from '../repositories/service-repository';

export async function findService(id: string, userId: string, repository: ServiceRepository) {
  const service = await repository.findById(id);
  if (!service || service.userId !== userId) throw new NotFoundException('Serviço não encontrado');
  return service;
}
