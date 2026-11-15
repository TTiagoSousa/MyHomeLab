import { NotFoundException } from '@nestjs/common';
import { UserRepository } from '../repositories/user-repository';

export async function findCurrentUser(id: string, repository: UserRepository) {
  const user = await repository.findById(id);
  if (!user) throw new NotFoundException('User not found');
  return user;
}
