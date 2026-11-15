import type { ConnectedAccount } from './useConnectedAccounts';

export const accountLabel = (account: ConnectedAccount) =>
  account.displayName ||
  [account.caldavUsername, account.caldavHost].filter(Boolean).join(' @ ') ||
  account.emailAddress ||
  account.provider;
