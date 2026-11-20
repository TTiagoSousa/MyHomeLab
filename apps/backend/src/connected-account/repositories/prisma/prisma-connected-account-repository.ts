import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConnectedAccountRepository } from '../connected-account-repository';
import {
  ConnectedAccount,
  ConnectionProvider,
  DocKind,
  DocLinkType,
  RunFrequency,
} from 'src/generated/prisma/client/client';
import { encryptToken, decryptToken } from 'src/utils/crypto/token-cipher';

/** A conta com os segredos em claro (na base de dados estão cifrados). */
export function decryptAccount(account: ConnectedAccount): ConnectedAccount {
  return {
    ...account,
    accessToken: account.accessToken ? decryptToken(account.accessToken) : null,
    refreshToken: account.refreshToken
      ? decryptToken(account.refreshToken)
      : null,
    caldavPassword: account.caldavPassword
      ? decryptToken(account.caldavPassword)
      : null,
    appPassword: account.appPassword ? decryptToken(account.appPassword) : null,
    apiClientSecret: account.apiClientSecret
      ? decryptToken(account.apiClientSecret)
      : null,
  };
}

@Injectable()
export class PrismaConnectedAccountRepository implements ConnectedAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ConnectedAccount | null> {
    const account = await this.prisma.connectedAccount.findUnique({
      where: { id },
    });
    return account ? decryptAccount(account) : null;
  }

  async findByUserAndEmail(
    userId: string,
    emailAddress: string,
    provider: ConnectionProvider,
  ): Promise<ConnectedAccount | null> {
    // O mesmo email pode estar ligado no Gmail e no Google Tasks (duas contas).
    const account = await this.prisma.connectedAccount.findFirst({
      where: { userId, emailAddress, provider },
    });
    return account ? decryptAccount(account) : null;
  }

  async findByUserAndCaldav(
    userId: string,
    caldavUrl: string,
    caldavUsername: string,
  ): Promise<ConnectedAccount | null> {
    const account = await this.prisma.connectedAccount.findFirst({
      where: { userId, caldavUrl, caldavUsername },
    });
    return account ? decryptAccount(account) : null;
  }

  async findAllByUser(
    userId: string,
    provider?: ConnectionProvider,
  ): Promise<ConnectedAccount[]> {
    const accounts = await this.prisma.connectedAccount.findMany({
      where: {
        userId,
        disconnectedAt: null,
        ...(provider ? { provider } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
    return accounts.map(decryptAccount);
  }

  /** As contas ativas de uma pessoa — é o que o assistente pode ver. */
  async findAllActiveByUser(userId: string): Promise<ConnectedAccount[]> {
    const accounts = await this.prisma.connectedAccount.findMany({
      where: { userId, isActive: true, disconnectedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return accounts.map(decryptAccount);
  }

  async findAllByProviders(
    providers: ConnectionProvider[],
  ): Promise<ConnectedAccount[]> {
    const accounts = await this.prisma.connectedAccount.findMany({
      where: { provider: { in: providers }, disconnectedAt: null },
    });
    return accounts.map(decryptAccount);
  }

  async findAllActiveAcrossUsers(): Promise<ConnectedAccount[]> {
    const accounts = await this.prisma.connectedAccount.findMany({
      where: { isActive: true, disconnectedAt: null },
    });
    return accounts.map(decryptAccount);
  }

  async create(data: {
    userId: string;
    provider: ConnectionProvider;
    emailAddress?: string;
    displayName?: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
    scopes?: string[];
    caldavUrl?: string;
    caldavUsername?: string;
    caldavPassword?: string;
    baseUrl?: string;
    username?: string;
    appPassword?: string;
    isAdmin?: boolean;
    apiClientId?: string;
    apiClientSecret?: string;
  }): Promise<ConnectedAccount> {
    const account = await this.prisma.connectedAccount.create({
      data: {
        ...data,
        accessToken: data.accessToken ? encryptToken(data.accessToken) : null,
        refreshToken: data.refreshToken
          ? encryptToken(data.refreshToken)
          : null,
        caldavPassword: data.caldavPassword
          ? encryptToken(data.caldavPassword)
          : null,
        appPassword: data.appPassword ? encryptToken(data.appPassword) : null,
        apiClientSecret: data.apiClientSecret
          ? encryptToken(data.apiClientSecret)
          : null,
      },
    });
    return decryptAccount(account);
  }

  /** As versões novas de uma conta (Apps ligadas → Atualizações), as mais recentes primeiro. */
  async findUpdates(accountId: string) {
    return this.prisma.appUpdate.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fromVersion: true,
        toVersion: true,
        releaseUrl: true,
        component: true,
        componentTitle: true,
        componentGroup: true,
        status: true,
        risk: true,
        summary: true,
        boardTaskKey: true,
        updateAfter: true,
        recheckAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /** O servidor é deste utilizador (para ligar uma app a ele). */
  async ownsServer(userId: string, serverId: string): Promise<boolean> {
    const server = await this.prisma.serverConnection.findFirst({
      where: { id: serverId, userId },
      select: { id: true },
    });
    return Boolean(server);
  }

  /**
   * Ao voltar a ligar a mesma app (mesmo endereço e utilizador), os documentos que
   * estavam ligados à conta desligada passam para a nova. Devolve quantos passaram.
   */
  async inheritDocLinks(account: ConnectedAccount, label: string) {
    const old = await this.prisma.connectedAccount.findMany({
      where: {
        userId: account.userId,
        provider: account.provider,
        id: { not: account.id },
        disconnectedAt: { not: null },
        baseUrl: account.baseUrl,
        caldavUrl: account.caldavUrl,
        username: account.username,
      },
      select: { id: true },
    });
    if (!old.length) return 0;
    const links = await this.prisma.docLink.findMany({
      where: {
        type: DocLinkType.APP,
        targetId: { in: old.map((item) => item.id) },
        // Os registos (das atualizações da conta antiga) ficam com ela.
        doc: { kind: { not: DocKind.LOG } },
      },
    });
    let moved = 0;
    for (const link of links) {
      const existing = await this.prisma.docLink.findUnique({
        where: {
          docId_type_targetId: {
            docId: link.docId,
            type: DocLinkType.APP,
            targetId: account.id,
          },
        },
      });
      if (existing) {
        await this.prisma.docLink.delete({ where: { id: link.id } });
        continue;
      }
      await this.prisma.docLink.update({
        where: { id: link.id },
        data: { targetId: account.id, label },
      });
      moved += 1;
    }
    return moved;
  }

  async update(
    id: string,
    data: Partial<{
      displayName: string;
      accessToken: string;
      refreshToken: string;
      tokenExpiresAt: Date;
      scopes: string[];
      isActive: boolean;
      runFrequency: RunFrequency;
      proposalFrequency: RunFrequency | null;
      lastProposalRunAt: Date;
      autoImplementProposalsAfterDays: number | null;
      lastRunAt: Date;
      caldavUrl: string;
      caldavUsername: string;
      caldavPassword: string;
      baseUrl: string;
      disconnectedAt: Date | null;
      isAdmin: boolean;
      appVersion: string | null;
      appLatestVersion: string | null;
      appLatestUrl: string | null;
      appCheckedAt: Date;
      serverConnectionId: string | null;
      guestVmid: number | null;
      apiClientId: string | null;
      apiClientSecret: string | null;
      username: string;
      appPassword: string;
    }>,
  ): Promise<ConnectedAccount> {
    const account = await this.prisma.connectedAccount.update({
      where: { id },
      data: {
        ...data,
        accessToken:
          data.accessToken !== undefined
            ? encryptToken(data.accessToken)
            : undefined,
        refreshToken:
          data.refreshToken !== undefined
            ? encryptToken(data.refreshToken)
            : undefined,
        caldavPassword:
          data.caldavPassword !== undefined
            ? encryptToken(data.caldavPassword)
            : undefined,
        appPassword:
          data.appPassword !== undefined
            ? encryptToken(data.appPassword)
            : undefined,
        apiClientSecret:
          data.apiClientSecret === undefined
            ? undefined
            : data.apiClientSecret && encryptToken(data.apiClientSecret),
      },
    });
    return decryptAccount(account);
  }

  // Desligar não apaga a linha: as regras de email e os pares de sincronização vivem
  // penduradas nela e voltam a valer se o mesmo email for religado. As credenciais são
  // limpas — quem religa passa outra vez pelo OAuth e recebe tokens novos.
  async disconnect(id: string): Promise<void> {
    await this.prisma.connectedAccount.update({
      where: { id },
      data: {
        disconnectedAt: new Date(),
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
        caldavPassword: null,
        appPassword: null,
        apiClientSecret: null,
        scopes: [],
        isActive: false,
      },
    });
  }
}
