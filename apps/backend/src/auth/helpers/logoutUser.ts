import { PrismaUserRepository } from 'src/user/repositories/prisma/prisma-user-repository';

/**
 * Sair sobe o tokenVersion: apagar só o cookie deixava válida qualquer cópia do token
 * até expirar. Termina as sessões do utilizador em todos os dispositivos (site e app).
 */
export async function logoutUser(
  userId: string,
  userRepository: PrismaUserRepository,
) {
  await userRepository.incrementTokenVersion(userId);
}
