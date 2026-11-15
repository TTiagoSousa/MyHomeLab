import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';

export async function listConnectedAccounts(
  userId: string,
  repository: PrismaConnectedAccountRepository,
  provider?: ConnectionProvider,
) {
  const accounts = await repository.findAllByUser(userId, provider);
  return accounts.map((account) => ({
    id: account.id,
    userId: account.userId,
    provider: account.provider,
    emailAddress: account.emailAddress,
    displayName: account.displayName,
    // Nextcloud: utilizador e servidor, para se reconhecer a conta sem nome (a password nunca sai).
    caldavUsername: account.caldavUsername,
    caldavHost: account.caldavUrl ? new URL(account.caldavUrl).host : null,
    // Forgejo: o utilizador do token e a instância (o token nunca sai).
    username: account.username,
    forgejoHost: account.baseUrl ? new URL(account.baseUrl).host : null,
    // Apps com endereço (Forgejo, TREK): o anfitrião, para a lista de contas.
    appHost: account.baseUrl ? new URL(account.baseUrl).host : null,
    isAdmin: account.isAdmin,
    appVersion: account.appVersion,
    appLatestVersion: account.appLatestVersion,
    appLatestUrl: account.appLatestUrl,
    // A última vez que se viu a versão (Conta → Última verificação).
    appCheckedAt: account.appCheckedAt,
    tokenExpiresAt: account.tokenExpiresAt,
    scopes: account.scopes,
    // Onde corre: o servidor e o CT/VM (apps do servidor).
    serverConnectionId: account.serverConnectionId,
    guestVmid: account.guestVmid,
    isActive: account.isActive,
    runFrequency: account.runFrequency,
    lastRunAt: account.lastRunAt,
    proposalFrequency: account.proposalFrequency,
    lastProposalRunAt: account.lastProposalRunAt,
    autoImplementProposalsAfterDays: account.autoImplementProposalsAfterDays,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  }));
}
