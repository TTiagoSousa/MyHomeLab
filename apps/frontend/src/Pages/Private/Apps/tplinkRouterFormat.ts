import type { TFunction } from 'i18next';
import type { TplinkBand, TplinkKind, TplinkNetwork } from '../../../Hooks/ConnectedAccount/useTplinkRouterStatus';
import { dateLocale } from '../../../i18n';

export const TPLINK_NETWORKS: TplinkNetwork[] = ['host', 'guest', 'iot'];
export const TPLINK_BANDS: TplinkBand[] = ['2g', '5g', '6g'];

export const formatUptime = (seconds: number | null, t: TFunction) => {
  if (seconds == null) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return t('addons:apps.tplinkRouter.duration.days', { days, hours });
  if (hours) return t('addons:apps.tplinkRouter.duration.hours', { hours, minutes });
  return t('addons:apps.tplinkRouter.duration.minutes', { minutes });
};

export const formatSpeed = (kilobytes: number | null) => {
  if (kilobytes == null) return '—';
  if (kilobytes >= 1024) return `${(kilobytes / 1024).toLocaleString(dateLocale(), { maximumFractionDigits: 1 })} MB/s`;
  return `${Math.round(kilobytes).toLocaleString(dateLocale())} KB/s`;
};

export const formatBytes = (bytes: number | null) => {
  if (bytes == null) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString(dateLocale(), { maximumFractionDigits: unit ? 1 : 0 })} ${units[unit]}`;
};

export const formatSignal = (value: number | null) => (value == null ? '—' : `${value} dBm`);

export const formatPercent = (value: number | null) => (value == null ? '—' : `${Math.round(value)}%`);

export const formatClockTime = (value: string) => new Date(value).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });

export const connectionLabel = (connection: string, t: TFunction) => {
  if (connection === 'wired') return t('addons:apps.tplinkRouter.connections.wired');
  const [network, band] = connection.split('_');
  if (!band || !['host', 'guest', 'iot'].includes(network)) return t('addons:apps.tplinkRouter.connections.unknown');
  return t('addons:apps.tplinkRouter.connections.wireless', {
    network: t(`addons:apps.tplinkRouter.networkShort.${network}`),
    band: t(`addons:apps.tplinkRouter.bands.${band}`),
  });
};

export const yesNo = (value: boolean | null, t: TFunction) =>
  value == null ? '—' : value ? t('addons:apps.tplinkRouter.on') : t('addons:apps.tplinkRouter.off');

export const EXTENDER_SCOPE = 'tplink-kind:extender';

export const accountKind = (scopes: string[] | undefined): TplinkKind => (scopes?.includes(EXTENDER_SCOPE) ? 'extender' : 'router');

export const formatRate = (value: number | null) => (value == null ? '—' : `${value} Mbps`);
