import { AppUpdate } from 'src/generated/prisma/client/client';

/**
 * O alvo de uma atualização: o servidor, a app, ou a peça dentro dela (as peças do HA e as
 * apps do Nextcloud contam cada uma à parte). Duas do mesmo alvo não andam ao mesmo tempo.
 */
export const updateTarget = (
  update: Pick<AppUpdate, 'accountId' | 'hostServerId' | 'component'>,
) =>
  update.hostServerId
    ? `server:${update.hostServerId}`
    : `app:${update.accountId}:${update.component ?? ''}`;
