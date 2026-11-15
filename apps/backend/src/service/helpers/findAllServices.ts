import { PrismaServiceRepository } from '../repositories/prisma/prisma-service-repository';

export async function findAllServices(userId: string, serviceRepository: PrismaServiceRepository) {
  return serviceRepository.findAllByUser(userId);
}
