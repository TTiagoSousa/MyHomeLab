import { NotFoundException } from '@nestjs/common';
import { ConnectedAccountRepository } from '../repositories/connected-account-repository';

export async function findConnectedAccount(
  id: string,
  userId: string,
  repository: ConnectedAccountRepository,
) {
  const account = await repository.findById(id);
  // Uma conta desligada continua na base de dados só para guardar as regras — para
  // o resto da API é como se não existisse.
  if (!account || account.userId !== userId || account.disconnectedAt)
    throw new NotFoundException('Conta não encontrada');
  return account;
}
