import { useTranslation } from 'react-i18next';
import type { TplinkRouterData } from '../../../Hooks/ConnectedAccount/useTplinkRouterStatus';
import type { TplinkRouterActionName, TplinkRouterActionPayload } from '../../../Hooks/ConnectedAccount/useTplinkRouterAction';
import Tplink_Router_Confirm from './Tplink_Router_Confirm';
import Tplink_Router_Backhaul from './Tplink_Router_Backhaul';
import { formatPercent, formatUptime, yesNo } from './tplinkRouterFormat';

interface Tplink_Router_Overview_Props {
  router: TplinkRouterData;
  running: TplinkRouterActionName | null;
  onAction: (payload: TplinkRouterActionPayload) => Promise<boolean>;
}

const Tplink_Router_Overview = ({ router, running, onAction }: Tplink_Router_Overview_Props) => {
  const { t } = useTranslation('addons');
  const { firmware, status } = router;
  const extender = router.kind === 'extender';

  return (
    <div className='Tplink_Router_Panel'>
      <div className='Tplink_Router_Boxes'>
        {extender ? (
          <Tplink_Router_Backhaul repeater={router.repeater} />
        ) : (
          <div className='Tplink_Router_Box'>
            <span className='Tplink_Router_Box_Title'>{t('apps.tplinkRouter.overview.internet')}</span>
            <dl className='Apps_details'>
              <dt>{t('apps.tplinkRouter.overview.wanIp')}</dt>
              <dd>{status.wanIp || '—'}</dd>
              <dt>{t('apps.tplinkRouter.overview.wanType')}</dt>
              <dd>{status.wanConnType || '—'}</dd>
              <dt>{t('apps.tplinkRouter.overview.gateway')}</dt>
              <dd>{status.wanGateway || '—'}</dd>
              <dt>{t('apps.tplinkRouter.overview.uptime')}</dt>
              <dd>{formatUptime(status.wanUptimeSeconds, t)}</dd>
              <dt>{t('apps.tplinkRouter.overview.ipv6')}</dt>
              <dd>{yesNo(status.wanIpv6Enabled, t)}</dd>
            </dl>
          </div>
        )}

        <div className='Tplink_Router_Box'>
          <span className='Tplink_Router_Box_Title'>{t('apps.tplinkRouter.overview.lan')}</span>
          <dl className='Apps_details'>
            <dt>{extender ? t('apps.tplinkRouter.overview.lanIpExtender') : t('apps.tplinkRouter.overview.lanIp')}</dt>
            <dd>{status.lanIp || '—'}</dd>
            {!extender && (
              <>
                <dt>{t('apps.tplinkRouter.overview.dhcp')}</dt>
                <dd>{yesNo(status.lanDhcpEnabled, t)}</dd>
              </>
            )}
            <dt>{t('apps.tplinkRouter.overview.lanMac')}</dt>
            <dd>{status.lanMac || '—'}</dd>
            {!extender && (
              <>
                <dt>{t('apps.tplinkRouter.overview.wanMac')}</dt>
                <dd>{status.wanMac || '—'}</dd>
              </>
            )}
          </dl>
        </div>

        <div className='Tplink_Router_Box'>
          <span className='Tplink_Router_Box_Title'>{t('apps.tplinkRouter.overview.system')}</span>
          <dl className='Apps_details'>
            <dt>{t('apps.tplinkRouter.overview.model')}</dt>
            <dd>{firmware.model || '—'}</dd>
            <dt>{t('apps.tplinkRouter.overview.hardware')}</dt>
            <dd>{firmware.hardwareVersion || '—'}</dd>
            <dt>{t('apps.tplinkRouter.overview.firmware')}</dt>
            <dd>{firmware.firmwareVersion || '—'}</dd>
            <dt>{t('apps.tplinkRouter.overview.cpu')}</dt>
            <dd>{formatPercent(status.cpuUsage)}</dd>
            <dt>{t('apps.tplinkRouter.overview.memory')}</dt>
            <dd>{formatPercent(status.memUsage)}</dd>
          </dl>
        </div>

        <div className='Tplink_Router_Box'>
          <span className='Tplink_Router_Box_Title'>{t('apps.tplinkRouter.overview.devices')}</span>
          <dl className='Apps_details'>
            <dt>{t('apps.tplinkRouter.overview.wired')}</dt>
            <dd>{status.wiredTotal}</dd>
            <dt>{t('apps.tplinkRouter.overview.wifi')}</dt>
            <dd>{status.wifiTotal}</dd>
            <dt>{t('apps.tplinkRouter.overview.guest')}</dt>
            <dd>{status.guestTotal}</dd>
            {!extender && (
              <>
                <dt>{t('apps.tplinkRouter.overview.iot')}</dt>
                <dd>{status.iotTotal}</dd>
              </>
            )}
          </dl>
        </div>
      </div>

      {router.ports.length > 0 && (
        <div className='Tplink_Router_Block'>
          <span className='Tplink_Router_Box_Title'>{t('apps.tplinkRouter.overview.ports')}</span>
          <div className='Tplink_Router_Ports'>
            {router.ports.map((port) => (
              <div key={port.port} className={`Tplink_Router_Port${port.linkUp ? ' up' : ''}`}>
                <span className='Tplink_Router_Port_Name'>{port.name || t('apps.tplinkRouter.overview.port', { port: port.port })}</span>
                <span className='Tplink_Router_Port_State'>
                  {port.linkUp
                    ? port.speedMbps
                      ? t('apps.tplinkRouter.overview.portSpeed', { speed: port.speedMbps, duplex: port.duplex ?? '' }).trim()
                      : t('apps.tplinkRouter.overview.portUp')
                    : t('apps.tplinkRouter.overview.portDown')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {router.mesh.length > 0 && (
        <div className='Tplink_Router_Block'>
          <span className='Tplink_Router_Box_Title'>{t('apps.tplinkRouter.overview.mesh')}</span>
          <div className='Apps_table_scroll'>
            <table className='Apps_table'>
              <thead>
                <tr>
                  <th>{t('apps.tplinkRouter.table.name')}</th>
                  <th>{t('apps.tplinkRouter.table.model')}</th>
                  <th>{t('apps.tplinkRouter.table.role')}</th>
                  <th>{t('apps.tplinkRouter.table.state')}</th>
                  <th>{t('apps.tplinkRouter.table.ip')}</th>
                  <th>{t('apps.tplinkRouter.table.clients')}</th>
                </tr>
              </thead>
              <tbody>
                {router.mesh.map((node) => (
                  <tr key={node.mac || node.name}>
                    <td className='name'>{node.name || '—'}</td>
                    <td>{node.model || '—'}</td>
                    <td>{node.role || '—'}</td>
                    <td>{node.status || '—'}</td>
                    <td>{node.ip || '—'}</td>
                    <td>{node.clients ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className='Apps_footer Tplink_Router_Footer'>
        <span className='Tplink_Router_Footer_Note'>
          {extender ? t('apps.tplinkRouter.overview.actionsNoteExtender') : t('apps.tplinkRouter.overview.actionsNote')}
        </span>
        {!extender && (
          <Tplink_Router_Confirm
            label={t('apps.tplinkRouter.overview.wanRenew')}
            confirmLabel={t('apps.tplinkRouter.overview.wanRenewConfirm')}
            question={t('apps.tplinkRouter.overview.wanRenewQuestion')}
            busy={running === 'wanRenew'}
            disabled={Boolean(running)}
            onConfirm={() => onAction({ action: 'wanRenew' })}
          />
        )}
        <Tplink_Router_Confirm
          danger
          label={extender ? t('apps.tplinkRouter.overview.rebootExtender') : t('apps.tplinkRouter.overview.reboot')}
          confirmLabel={t('apps.tplinkRouter.overview.rebootConfirm')}
          question={extender ? t('apps.tplinkRouter.overview.rebootExtenderQuestion') : t('apps.tplinkRouter.overview.rebootQuestion')}
          busy={running === 'reboot'}
          disabled={Boolean(running)}
          onConfirm={() => onAction({ action: 'reboot' })}
        />
      </div>
    </div>
  );
};

export default Tplink_Router_Overview;
