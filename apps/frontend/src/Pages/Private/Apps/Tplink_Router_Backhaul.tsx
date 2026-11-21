import { useTranslation } from 'react-i18next';
import type { TplinkBackhaulBand, TplinkRepeater } from '../../../Hooks/ConnectedAccount/useTplinkRouterStatus';
import { formatRate, formatSignal, yesNo } from './tplinkRouterFormat';

const Backhaul_Band = ({ label, band }: { label: string; band: TplinkBackhaulBand }) => {
  const { t } = useTranslation('addons');

  return (
    <>
      <dt>{label}</dt>
      <dd className='Tplink_Router_Backhaul_Value'>
        <span className={`Apps_chip${band.connected ? ' on' : ' off'}`}>
          {band.connected ? t('apps.tplinkRouter.backhaul.connected') : t('apps.tplinkRouter.backhaul.disconnected')}
        </span>
        {band.connected && (
          <span className='Tplink_Router_Backhaul_Detail'>
            {[
              band.ssid,
              band.rssi != null ? t('apps.tplinkRouter.backhaul.signal', { value: formatSignal(band.rssi) }) : null,
              band.rxRateMbps != null || band.txRateMbps != null
                ? t('apps.tplinkRouter.backhaul.rate', { rx: formatRate(band.rxRateMbps), tx: formatRate(band.txRateMbps) })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        )}
      </dd>
    </>
  );
};

const Tplink_Router_Backhaul = ({ repeater }: { repeater: TplinkRepeater | null }) => {
  const { t } = useTranslation('addons');

  const internetLabel = (value: string | null) =>
    !value ? '—' : value.toLowerCase() === 'connected' ? t('apps.tplinkRouter.backhaul.internetConnected') : value;

  return (
    <div className='Tplink_Router_Box'>
      <span className='Tplink_Router_Box_Title'>{t('apps.tplinkRouter.backhaul.title')}</span>
      {repeater ? (
        <dl className='Apps_details'>
          {repeater.wired?.connected ? (
            <>
              <dt>{t('apps.tplinkRouter.backhaul.link')}</dt>
              <dd className='Tplink_Router_Backhaul_Value'>
                <span className='Apps_chip on'>{t('apps.tplinkRouter.backhaul.connected')}</span>
                <span>{repeater.wired.ip ? t('apps.tplinkRouter.backhaul.wiredIp', { ip: repeater.wired.ip }) : t('apps.tplinkRouter.backhaul.wired')}</span>
              </dd>
            </>
          ) : (
            <>
              <Backhaul_Band label={t('apps.tplinkRouter.bands.5g')} band={repeater.band5g} />
              <Backhaul_Band label={t('apps.tplinkRouter.bands.2g')} band={repeater.band2g} />
            </>
          )}
          <dt>{t('apps.tplinkRouter.backhaul.internet')}</dt>
          <dd>{internetLabel(repeater.internetStatus)}</dd>
          <dt>{t('apps.tplinkRouter.backhaul.mesh')}</dt>
          <dd className='Tplink_Router_Backhaul_Value'>
            <span>{yesNo(repeater.meshEnabled, t)}</span>
            {repeater.meshSync && (
              <span className='Tplink_Router_Backhaul_Detail'>{t('apps.tplinkRouter.backhaul.meshSync', { sync: repeater.meshSync })}</span>
            )}
          </dd>
        </dl>
      ) : (
        <p className='Apps_section_note'>{t('apps.tplinkRouter.backhaul.unknown')}</p>
      )}
    </div>
  );
};

export default Tplink_Router_Backhaul;
