import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TplinkRouterData } from '../../../Hooks/ConnectedAccount/useTplinkRouterStatus';
import type { TplinkRouterActionName, TplinkRouterActionPayload } from '../../../Hooks/ConnectedAccount/useTplinkRouterAction';
import Tplink_Router_Confirm from './Tplink_Router_Confirm';
import Tplink_Router_Reservation_Form, { type Reservation_Draft } from './Tplink_Router_Reservation_Form';
import { connectionLabel, formatBytes, formatSignal, formatSpeed, formatUptime } from './tplinkRouterFormat';
import * as Icon from '../../../Imports/icons';

interface Tplink_Router_Devices_Props {
  router: TplinkRouterData;
  running: TplinkRouterActionName | null;
  onAction: (payload: TplinkRouterActionPayload) => Promise<boolean>;
}

const sameMac = (a: string, b: string) => a.replace(/[^0-9a-f]/gi, '').toLowerCase() === b.replace(/[^0-9a-f]/gi, '').toLowerCase();

const Tplink_Router_Devices = ({ router, running, onAction }: Tplink_Router_Devices_Props) => {
  const { t } = useTranslation('addons');
  const [search, setSearch] = useState('');
  const [reserving, setReserving] = useState<Reservation_Draft | null>(null);
  const extender = router.kind === 'extender';

  const words = search.trim().toLowerCase();
  const devices = [...router.status.devices]
    .sort((a, b) => Number(!a.hostname) - Number(!b.hostname) || (a.hostname || a.mac).localeCompare(b.hostname || b.mac))
    .filter((device) =>
      words
        ? `${device.hostname} ${device.ip} ${device.mac} ${device.apName ?? ''} ${connectionLabel(device.connection, t)}`.toLowerCase().includes(words)
        : true,
    );

  const allDevices = router.status.devices;
  const showAp = !extender && allDevices.some((device) => device.apName);
  const showSpeed = allDevices.some((device) => device.downSpeed != null || device.upSpeed != null);
  const showOnline = allDevices.some((device) => device.onlineSeconds != null);
  const showTraffic = allDevices.some((device) => device.trafficBytes != null);

  const isReserved = (mac: string) => router.reservations.some((item) => sameMac(item.mac, mac));
  const isBlocked = (mac: string) => router.blocked.some((item) => sameMac(item.mac, mac));

  const saveReservation = async (draft: Reservation_Draft) => {
    if (await onAction({ action: 'reservationAdd', ...draft })) setReserving(null);
  };

  return (
    <div className='Tplink_Router_Panel'>
      <label className='Apps_search'>
        <Icon.Search />
        <input
          type='search'
          value={search}
          placeholder={t('apps.tplinkRouter.devices.search')}
          aria-label={t('apps.tplinkRouter.devices.search')}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>

      {reserving && (
        <Tplink_Router_Reservation_Form
          key={reserving.mac}
          initial={reserving}
          busy={running === 'reservationAdd'}
          onCancel={() => setReserving(null)}
          onSave={(draft) => void saveReservation(draft)}
        />
      )}

      {devices.length ? (
        <div className='Apps_table_scroll'>
          <table className='Apps_table Tplink_Router_Table'>
            <thead>
              <tr>
                <th>{t('apps.tplinkRouter.table.name')}</th>
                <th>{t('apps.tplinkRouter.table.ip')}</th>
                <th>{t('apps.tplinkRouter.table.mac')}</th>
                <th>{t('apps.tplinkRouter.table.connection')}</th>
                {showAp && <th>{t('apps.tplinkRouter.table.ap')}</th>}
                <th>{t('apps.tplinkRouter.table.signal')}</th>
                {showSpeed && <th>{t('apps.tplinkRouter.table.speed')}</th>}
                {showOnline && <th>{t('apps.tplinkRouter.table.online')}</th>}
                {showTraffic && <th>{t('apps.tplinkRouter.table.traffic')}</th>}
                {!extender && <th aria-label={t('apps.tplinkRouter.table.actions')} />}
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.mac}>
                  <td className='name wrap'>{device.hostname || t('apps.tplinkRouter.devices.noName')}</td>
                  <td className='Tplink_Router_Nowrap'>{device.ip || '—'}</td>
                  <td className='Tplink_Router_Nowrap'>{device.mac}</td>
                  <td className='wrap Tplink_Router_Connection_Cell'>{connectionLabel(device.connection, t)}</td>
                  {showAp && (
                    <td className='wrap'>
                      <span className='Tplink_Router_Ap'>
                        {device.apName || '—'}
                        {device.viaSatellite && <span className='Apps_chip'>{t('apps.tplinkRouter.devices.viaExtender')}</span>}
                      </span>
                    </td>
                  )}
                  <td className='Tplink_Router_Nowrap'>{formatSignal(device.signal)}</td>
                  {showSpeed && (
                    <td className='Tplink_Router_Nowrap'>
                      <span className='Tplink_Router_Speed'>
                        <span>{t('apps.tplinkRouter.devices.speedDown', { value: formatSpeed(device.downSpeed) })}</span>
                        <span>{t('apps.tplinkRouter.devices.speedUp', { value: formatSpeed(device.upSpeed) })}</span>
                      </span>
                    </td>
                  )}
                  {showOnline && <td className='Tplink_Router_Nowrap'>{formatUptime(device.onlineSeconds, t)}</td>}
                  {showTraffic && <td className='Tplink_Router_Nowrap'>{formatBytes(device.trafficBytes)}</td>}
                  {!extender && (
                    <td>
                      <div className='Apps_footer Tplink_Router_Row_Actions'>
                        {isReserved(device.mac) ? (
                          <span className='Apps_chip on'>{t('apps.tplinkRouter.devices.reserved')}</span>
                        ) : (
                          <button
                            type='button'
                            onClick={() => setReserving({ mac: device.mac, ip: device.ip, name: device.hostname })}
                            disabled={Boolean(running)}
                          >
                            {t('apps.tplinkRouter.devices.reserve')}
                          </button>
                        )}
                        {isBlocked(device.mac) ? (
                          <span className='Apps_chip update'>{t('apps.tplinkRouter.devices.blocked')}</span>
                        ) : (
                          <Tplink_Router_Confirm
                            danger
                            quiet
                            label={t('apps.tplinkRouter.devices.block')}
                            confirmLabel={t('apps.tplinkRouter.devices.blockConfirm')}
                            busy={running === 'block'}
                            disabled={Boolean(running)}
                            onConfirm={() => onAction({ action: 'block', mac: device.mac, name: device.hostname || device.mac })}
                          />
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className='Apps_section_note'>{words ? t('apps.tplinkRouter.devices.noResults') : t('apps.tplinkRouter.devices.none')}</p>
      )}

      <p className='Apps_section_note'>{extender ? t('apps.tplinkRouter.devices.extenderHint') : t('apps.tplinkRouter.devices.blockHint')}</p>
    </div>
  );
};

export default Tplink_Router_Devices;
