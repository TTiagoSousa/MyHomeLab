import { toAccountView } from './toAccountView';
import { listConnectedAccounts } from './listConnectedAccounts';
import { updateConnectedAccount } from './updateConnectedAccount';
import { ConnectedAccountService } from '../connected-account.service';
import {
  ConnectedAccount,
  ConnectionProvider,
  RunFrequency,
} from 'src/generated/prisma/client/client';

const SECRETS = {
  accessToken: 'ya29.segredo-de-acesso',
  refreshToken: '1//segredo-de-refresh',
  caldavPassword: 'password-nextcloud',
  appPassword: 'password-do-router',
  apiClientSecret: 'client-secret-do-mcp',
};

const account: ConnectedAccount = {
  id: 'acc-1',
  userId: 'user-1',
  provider: ConnectionProvider.TPLINK_ROUTER,
  emailAddress: null,
  displayName: 'Router',
  ...SECRETS,
  tokenExpiresAt: null,
  scopes: ['tplink:sg'],
  caldavUrl: 'https://cloud.example/remote.php/dav',
  caldavUsername: 'ana',
  baseUrl: 'http://192.168.1.1',
  username: 'admin',
  isAdmin: true,
  apiClientId: 'client-id',
  appVersion: '1.0',
  appLatestVersion: null,
  appLatestUrl: null,
  appCheckedAt: null,
  serverConnectionId: null,
  guestVmid: null,
  isActive: true,
  runFrequency: RunFrequency.HOURLY,
  lastRunAt: null,
  proposalFrequency: null,
  lastProposalRunAt: null,
  autoImplementProposalsAfterDays: null,
  disconnectedAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

function expectNoSecrets(view: object) {
  const text = JSON.stringify(view);
  for (const [field, value] of Object.entries(SECRETS)) {
    expect(view).not.toHaveProperty(field);
    expect(text).not.toContain(value);
  }
}

describe('toAccountView', () => {
  it('tira tokens, passwords e secrets', () => {
    const view = toAccountView(account);
    expectNoSecrets(view);
    expect(view).toMatchObject({
      id: 'acc-1',
      displayName: 'Router',
      appHost: '192.168.1.1',
      appBaseUrl: 'http://192.168.1.1',
      caldavHost: 'cloud.example',
      username: 'admin',
    });
  });

  it('a lista usa a mesma vista', async () => {
    const repository = {
      findAllByUser: jest.fn().mockResolvedValue([account]),
    } as never;
    const list = await listConnectedAccounts('user-1', repository);
    expect(list).toEqual([toAccountView(account)]);
  });

  it('o PATCH devolve a vista e não a conta decifrada', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue(account),
      update: jest.fn().mockResolvedValue(account),
    };
    expect(
      await updateConnectedAccount('acc-1', 'user-1', {}, repository as never),
    ).toBe(account);
    const service = new ConnectedAccountService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const view = await service.update('acc-1', 'user-1', {
      runFrequency: RunFrequency.DAILY,
    });
    expectNoSecrets(view);
    expect(view.id).toBe('acc-1');
  });
});
