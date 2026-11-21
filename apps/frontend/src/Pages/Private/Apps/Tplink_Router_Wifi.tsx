import { useTranslation } from 'react-i18next';
import type { TplinkBand, TplinkNetwork, TplinkRouterData } from '../../../Hooks/ConnectedAccount/useTplinkRouterStatus';
import type { TplinkRouterActionName, TplinkRouterActionPayload } from '../../../Hooks/ConnectedAccount/useTplinkRouterAction';
import Tplink_Router_Confirm from './Tplink_Router_Confirm';
import { TPLINK_BANDS, TPLINK_NETWORKS } from './tplinkRouterFormat';

interface Tplink_Router_Wifi_Props {
  router: TplinkRouterData;
  running: TplinkRouterActionName | null;
  onAction: (payload: TplinkRouterActionPayload) => Promise<boolean>;
}

interface Wifi_Row {
  network: TplinkNetwork;
  band: TplinkBand;
  enabled: boolean | null;
  ssid: string | null;
  hidden: boolean | null;
  encryption: string | null;
  channel: number | null;
}

const Tplink_Router_Wifi = ({ router, running, onAction }: Tplink_Router_Wifi_Props) => {
  const { t } = useTranslation('addons');

  const rows: Wifi_Row[] = TPLINK_NETWORKS.flatMap((network) =>
    TPLINK_BANDS.filter((band) => router.status.wifi[network]?.[band] != null).map((band) => {
      const detail = router.wifi.find((item) => item.network === network && item.band === band);
      return {
        network,
        band,
        enabled: detail?.enabled ?? router.status.wifi[network]?.[band] ?? null,
        ssid: detail?.ssid ?? null,
        hidden: detail?.hidden ?? null,
        encryption: detail?.encryption ?? null,
        channel: detail?.channel ?? null,
      };
    }),
  );

  const mloBands = TPLINK_BANDS.filter((band) => router.status.mlo[band]);
  const toggle = (row: Wifi_Row) => onAction({ action: 'wifi', network: row.network, band: row.band, enabled: !row.enabled });

  return (
    <div className='Tplink_Router_Panel'>
      {rows.length === 0 && <p className='Apps_section_note'>{t('apps.tplinkRouter.wifi.none')}</p>}

      {TPLINK_NETWORKS.filter((network) => rows.some((row) => row.network === network)).map((network) => (
        <div key={network} className='Tplink_Router_Block'>
          <span className='Tplink_Router_Box_Title'>{t(`apps.tplinkRouter.networks.${network}`)}</span>
          <div className='Tplink_Router_Rows'>
            {rows
              .filter((row) => row.network === network)
              .map((row) => (
                <div key={row.band} className='Tplink_Router_Row'>
                  <div className='Tplink_Router_Row_Info'>
                    <span className='Tplink_Router_Row_Title'>
                      {row.ssid || t('apps.tplinkRouter.wifi.noName')}
                      <span className='Apps_chip'>{t(`apps.tplinkRouter.bands.${row.band}`)}</span>
                      <span className={`Apps_chip${row.enabled ? ' on' : ' off'}`}>
                        {row.enabled ? t('apps.tplinkRouter.wifi.enabled') : t('apps.tplinkRouter.wifi.disabled')}
                      </span>
                    </span>
                    <span className='Tplink_Router_Row_Meta'>
                      {[
                        row.encryption ? t('apps.tplinkRouter.wifi.security', { value: row.encryption }) : null,
                        row.channel ? t('apps.tplinkRouter.wifi.channel', { value: row.channel }) : null,
                        row.hidden ? t('apps.tplinkRouter.wifi.hidden') : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </span>
                  </div>
                  <div className='Apps_footer Tplink_Router_Row_Actions'>
                    {row.enabled && row.network === 'host' ? (
                      <Tplink_Router_Confirm
                        danger
                        label={t('apps.tplinkRouter.wifi.turnOff')}
                        confirmLabel={t('apps.tplinkRouter.wifi.turnOffConfirm')}
                        question={t('apps.tplinkRouter.wifi.turnOffQuestion')}
                        busy={running === 'wifi'}
                        disabled={Boolean(running)}
                        onConfirm={() => toggle(row)}
                      />
                    ) : (
                      <button type='button' className={row.enabled ? '' : 'primary'} onClick={() => void toggle(row)} disabled={Boolean(running)}>
                        {row.enabled ? t('apps.tplinkRouter.wifi.turnOff') : t('apps.tplinkRouter.wifi.turnOn')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}

      {mloBands.length > 0 && (
        <p className='Apps_section_note'>
          {t('apps.tplinkRouter.wifi.mlo', { bands: mloBands.map((band) => t(`apps.tplinkRouter.bands.${band}`)).join(', ') })}
        </p>
      )}
    </div>
  );
};

export default Tplink_Router_Wifi;
