import { PrismaServiceRepository } from '../repositories/prisma/prisma-service-repository';
import { findService } from './findService';

export async function deleteService(
  id: string,
  userId: string,
  serviceRepository: PrismaServiceRepository,
) {
  const service = await findService(id, userId, serviceRepository);
  await serviceRepository.delete(id);
  await serviceRepository.decrementOrderAfter(
    service.categoryId,
    service.order,
  );
}
