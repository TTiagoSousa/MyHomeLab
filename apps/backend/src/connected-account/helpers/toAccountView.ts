import { ConnectedAccount } from 'src/generated/prisma/client/client';

/**
 * A conta como sai para o browser: o que a identifica e as definições dela. Tokens,
 * passwords e secrets (que o repositório já devolve decifrados) ficam de fora — antes
 * o PATCH e os POST de ligar devolviam a linha inteira e um XSS ou uma extensão do
 * browser levava-os. Qualquer endpoint que devolva uma conta passa por aqui.
 */
export function toAccountView(account: ConnectedAccount) {
  return {
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
    // O endereço tal como foi guardado (http/https, porta, subcaminho), para o modal de trocar
    // o token o pré-preencher sem o adivinhar a partir do anfitrião. Sem utilizador:password.
    appBaseUrl: account.baseUrl
      ? account.baseUrl.replace(/\/\/[^/@]*@/, '//')
      : null,
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
  };
}

export type ConnectedAccountView = ReturnType<typeof toAccountView>;
