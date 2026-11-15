import type { TFunction } from 'i18next';
import { dateLocale } from '../../../i18n';

export const authorLabel = (by: string, t: TFunction) => (by === 'user' ? t('docs:you') : by);

export const formatVersionDate = (value: string) =>
  new Date(value).toLocaleString(dateLocale(), { dateStyle: 'medium', timeStyle: 'short' });
