import type { AccountUpdate } from '../../../Hooks/ConnectedAccount/useAccountUpdates';

export const updateStatusKey = (update: AccountUpdate) => (update.status === 'NEW' && !update.boardTaskKey ? 'AVAILABLE' : update.status);
