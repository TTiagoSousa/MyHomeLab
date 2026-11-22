import {
  ConnectedAccount,
  ConnectionProvider,
  RunFrequency,
} from 'src/generated/prisma/client/client';

export interface ConnectedAccountRepository {
  findById(id: string): Promise<ConnectedAccount | null>;
  findByUserAndEmail(
    userId: string,
    emailAddress: string,
    provider: ConnectionProvider,
  ): Promise<ConnectedAccount | null>;
  findByUserAndCaldav(
    userId: string,
    caldavUrl: string,
    caldavUsername: string,
  ): Promise<ConnectedAccount | null>;
  findAllByUser(
    userId: string,
    provider?: ConnectionProvider,
  ): Promise<ConnectedAccount[]>;
  findAllActiveAcrossUsers(): Promise<ConnectedAccount[]>;
  create(data: {
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
    isAdmin?: boolean;
  }): Promise<ConnectedAccount>;
  update(
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
    }>,
  ): Promise<ConnectedAccount>;
  disconnect(id: string): Promise<void>;
  markNeedsReconnect(account: ConnectedAccount, message: string): Promise<void>;
  resolveNeedsReconnect(account: ConnectedAccount): Promise<void>;
}
