import { useTranslation } from 'react-i18next';
import type { ServiceMonitor } from '../../../Hooks/ServiceMonitors/useServiceMonitors';
import { dateLocale } from '../../../i18n';

const statusClass = (monitor: ServiceMonitor) => {
  if (monitor.status === 'UP') return 'on';
  if (monitor.status === 'DOWN') return 'down';
  return 'off';
};

interface Service_Monitor_Row_Props {
  monitor: ServiceMonitor;
  checking: boolean;
  confirmingRemove: boolean;
  onCheck: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

const Service_Monitor_Row = ({
  monitor,
  checking,
  confirmingRemove,
  onCheck,
  onEdit,
  onRemove,
}: Service_Monitor_Row_Props) => {
  const { t } = useTranslation('servers');
  const { t: tServices } = useTranslation('services');
  const status = statusClass(monitor);

  const lastChecked = monitor.lastCheckedAt
    ? new Date(monitor.lastCheckedAt).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })
    : '—';

  const link = !monitor.server
    ? t('monitors.noServer')
    : monitor.guestVmid
      ? `${monitor.server.name} · ${monitor.guestName ?? monitor.guestVmid}`
      : monitor.server.name;

  return (
    <div className={`Servers_monitor ${status}`}>
      <i className={`Servers_dot ${status}`} />

      <div className='Servers_monitor_info'>
        <span className='Servers_monitor_name'>
          {monitor.name}
          <span className='Servers_tag'>{monitor.kind}</span>
          {monitor.app && <span className='Servers_tag'>{tServices('appMonitor.fromApp', { name: monitor.app.name })}</span>}
        </span>
        <span className='Servers_monitor_target'>{monitor.target}</span>
        <span className='Servers_monitor_meta'>
          {link} · {t('monitors.every', { count: monitor.intervalMinutes })}
        </span>
        {monitor.guestMissing && <span className='Servers_monitor_error'>{t('monitors.machineMissing')}</span>}
        {monitor.status === 'DOWN' && monitor.lastError && <span className='Servers_monitor_error'>{monitor.lastError}</span>}
      </div>

      <div className='Servers_monitor_state'>
        <span className={`Servers_monitor_status ${status}`}>{t(`monitors.status.${monitor.status}`)}</span>
        <span className='Servers_monitor_meta'>
          {monitor.lastLatencyMs != null && `${monitor.lastLatencyMs} ms · `}
          {lastChecked}
        </span>
      </div>

      <div className='Servers_monitor_actions'>
        <button type='button' onClick={onCheck} disabled={checking}>
          {checking ? t('monitors.checking') : t('monitors.checkNow')}
        </button>
        <button type='button' onClick={onEdit}>
          {t('monitors.edit')}
        </button>
        {!monitor.app && (
          <button type='button' className={`danger${confirmingRemove ? ' confirm' : ''}`} onClick={onRemove}>
            {confirmingRemove ? t('monitors.confirmRemove') : t('monitors.remove')}
          </button>
        )}
      </div>
    </div>
  );
};

export default Service_Monitor_Row;
