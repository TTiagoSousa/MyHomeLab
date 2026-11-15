import type { TFunction } from 'i18next';

export const formatRelativeTime = (value: string | null, t: TFunction) => {
  if (!value) return t('addons:relativeTime.never');

  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t('addons:relativeTime.justNow');
  if (minutes < 60) return t('addons:relativeTime.minutesAgo', { count: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('addons:relativeTime.hoursAgo', { count: hours });

  const days = Math.floor(hours / 24);
  return t('addons:relativeTime.daysAgo', { count: days });
};
