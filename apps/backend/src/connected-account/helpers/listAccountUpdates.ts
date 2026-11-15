import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { findConnectedAccount } from './findConnectedAccount';

/**
 * As versões novas de uma app ligada, todas (as novas, as estudadas e as já
 * instaladas), para a secção Atualizações da página da app. O estado de cada uma
 * é o do quadro de tarefas; aqui só se mostra.
 */
export async function listAccountUpdates(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  await findConnectedAccount(id, userId, repository);
  return repository.findUpdates(id);
}
