import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';

/** As contas Gmail ligadas, uma por linha — para o agente escolher a certa. */
export async function listConnectedEmails(
  connectedAccountRepository: PrismaConnectedAccountRepository,
  userId: string,
): Promise<string> {
  const accounts = (
    await connectedAccountRepository.findAllActiveByUser(userId)
  ).filter((account) => account.provider === ConnectionProvider.GMAIL);

  if (accounts.length === 0) return 'Não há nenhuma conta Gmail ligada.';

  return accounts.map((account) => account.emailAddress).join('\n');
}
