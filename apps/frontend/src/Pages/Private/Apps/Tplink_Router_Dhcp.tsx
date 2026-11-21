import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TplinkRouterData } from '../../../Hooks/ConnectedAccount/useTplinkRouterStatus';
import type { TplinkRouterActionName, TplinkRouterActionPayload } from '../../../Hooks/ConnectedAccount/useTplinkRouterAction';
import Tplink_Router_Confirm from './Tplink_Router_Confirm';
import Tplink_Router_Reservation_Form, { type Reservation_Draft } from './Tplink_Router_Reservation_Form';
import { yesNo } from './tplinkRouterFormat';

interface Tplink_Router_Dhcp_Props {
  router: TplinkRouterData;
  running: TplinkRouterActionName | null;
  onAction: (payload: TplinkRouterActionPayload) => Promise<boolean>;
}

const Tplink_Router_Dhcp = ({ router, running, onAction }: Tplink_Router_Dhcp_Props) => {
  const { t } = useTranslation('addons');
  const [adding, setAdding] = useState(false);
  const extender = router.kind === 'extender';

  const saveReservation = async (draft: Reservation_Draft) => {
    if (await onAction({ action: 'reservationAdd', ...draft })) setAdding(false);
  };

  return (
    <div className='Tplink_Router_Panel'>
      {!extender && (
        <div className='Tplink_Router_Block'>
          <div className='Tplink_Router_Block_Head'>
            <span className='Tplink_Router_Box_Title'>{t('apps.tplinkRouter.dhcp.reservations', { count: router.reservations.length })}</span>
            {!adding && (
              <div className='Apps_footer Tplink_Router_Row_Actions'>
                <button type='button' onClick={() => setAdding(true)} disabled={Boolean(running)}>
                  {t('apps.tplinkRouter.dhcp.add')}
                </button>
              </div>
            )}
          </div>

          {adding && (
            <Tplink_Router_Reservation_Form
              initial={{ mac: '', ip: '', name: '' }}
              busy={running === 'reservationAdd'}
              onCancel={() => setAdding(false)}
              onSave={(draft) => void saveReservation(draft)}
            />
          )}

          {router.reservations.length ? (
            <div className='Apps_table_scroll'>
              <table className='Apps_table Tplink_Router_Table'>
                <thead>
                  <tr>
                    <th>{t('apps.tplinkRouter.table.name')}</th>
                    <th>{t('apps.tplinkRouter.table.ip')}</th>
                    <th>{t('apps.tplinkRouter.table.mac')}</th>
                    <th>{t('apps.tplinkRouter.table.state')}</th>
                    <th aria-label={t('apps.tplinkRouter.table.actions')} />
                  </tr>
                </thead>
                <tbody>
                  {router.reservations.map((reservation) => (
                    <tr key={reservation.mac}>
                      <td className='name wrap'>{reservation.name || '—'}</td>
                      <td>{reservation.ip}</td>
                      <td>{reservation.mac}</td>
                      <td>{yesNo(reservation.enabled, t)}</td>
                      <td>
                        <div className='Apps_footer Tplink_Router_Row_Actions'>
                          <Tplink_Router_Confirm
                            danger
                            quiet
                            label={t('apps.tplinkRouter.dhcp.delete')}
                            confirmLabel={t('apps.tplinkRouter.dhcp.deleteConfirm')}
                            busy={running === 'reservationDelete'}
                            disabled={Boolean(running)}
                            onConfirm={() => onAction({ action: 'reservationDelete', mac: reservation.mac })}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className='Apps_section_note'>{t('apps.tplinkRouter.dhcp.noReservations')}</p>
          )}
        </div>
      )}

      <div className='Tplink_Router_Block'>
        <span className='Tplink_Router_Box_Title'>{t('apps.tplinkRouter.dhcp.leases', { count: router.leases.length })}</span>
        {router.leases.length ? (
          <div className='Apps_table_scroll'>
            <table className='Apps_table Tplink_Router_Table'>
              <thead>
                <tr>
                  <th>{t('apps.tplinkRouter.table.name')}</th>
                  <th>{t('apps.tplinkRouter.table.ip')}</th>
                  <th>{t('apps.tplinkRouter.table.mac')}</th>
                  <th>{t('apps.tplinkRouter.table.leaseTime')}</th>
                </tr>
              </thead>
              <tbody>
                {router.leases.map((lease) => (
                  <tr key={lease.mac}>
                    <td className='name wrap'>{lease.name || '—'}</td>
                    <td>{lease.ip}</td>
                    <td>{lease.mac}</td>
                    <td>{lease.leaseTime || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className='Apps_section_note'>{t('apps.tplinkRouter.dhcp.noLeases')}</p>
        )}
      </div>
      {extender && <p className='Apps_section_note'>{t('apps.tplinkRouter.dhcp.extenderHint')}</p>}
    </div>
  );
};

export default Tplink_Router_Dhcp;
