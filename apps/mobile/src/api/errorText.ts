import i18n from '../i18n';
import { ApiError, NETWORK_ERROR } from './client';

export const errorText = (error: unknown) => {
  if (error instanceof ApiError && error.status === NETWORK_ERROR) return i18n.t('error.network');
  if (error instanceof ApiError && error.message) return error.message;
  return i18n.t('error.generic');
};
