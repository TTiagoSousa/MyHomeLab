import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import './Notifications.scss';
import { useNotifications, type AppNotification, type NotificationKind } from '../../../Hooks/Notifications/useNotifications';
import { useCheckMonitor } from '../../../Hooks/ServiceMonitors/useCheckMonitor';
import { dateLocale } from '../../../i18n';
import { SUMMARY_PREFIX, askPage, isAsk, appPage } from '../../../Hooks/Notifications/notificationPage';
import Agent_Summary from './Agent_Summary';
import Page_Help from '../../../Components/Page_Help/Page_Help';
import * as Icon from '../../../Imports/icons';

const WARNING_KINDS: NotificationKind[] = ['APP_UPDATE', 'DISK_WARNING', 'CERT_EXPIRING', 'BACKUP_FAILED', 'APP_WARNING'];

const formatDateTime = (date: string) =>
  new Date(date).toLocaleString(dateLocale(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const Notifications = () => {
  const { t } = useTranslation('notifications');
  const navigate = useNavigate();
  const { active, resolved, loading, clearResolved, dismiss } = useNotifications();
  const { checkingId, checkMonitor } = useCheckMonitor();
  const [showResolved, setShowResolved] = useState(false);

  const asks = active.filter(isAsk);
  const warnings = active.filter((notification) => !isAsk(notification));

  const stateClass = (notification: AppNotification, isActive: boolean) => {
    if (!isActive) return 'resolved';
    if (notification.kind === 'AGENT_NOTICE') return 'active notice';
    return WARNING_KINDS.includes(notification.kind) ? 'active update' : 'active';
  };

  const renderAsk = (notification: AppNotification) => (
    <button type='button' className='Notifications_card active notice Notifications_ask' key={notification.id} onClick={() => navigate(askPage(notification))}>
      <span className='Notifications_dot active notice' />
      <span className='Notifications_text'>
        <span className='Notifications_title'>{notification.title}</span>
        <span className='Notifications_message clamp'>{notification.message}</span>
        <span className='Notifications_time'>{t('since', { date: formatDateTime(notification.createdAt) })}</span>
      </span>
      <span className='Notifications_open'>
        {t('open')}
        <Icon.Chevron />
      </span>
    </button>
  );

  const renderCard = (notification: AppNotification, isActive: boolean) => (
    <div className={`Notifications_card ${stateClass(notification, isActive)}`} key={notification.id}>
      <span className={`Notifications_dot ${stateClass(notification, isActive)}`} />

      <div className='Notifications_text'>
        <span className='Notifications_title'>{notification.title}</span>
        {notification.subject?.startsWith(SUMMARY_PREFIX) ? (
          <Agent_Summary day={notification.subject.slice(SUMMARY_PREFIX.length)} initialMessage={notification.message} />
        ) : (
          <span className='Notifications_message'>{notification.message}</span>
        )}
        {notification.related?.map((related) => (
          <span key={related.id} className='Notifications_related'>
            {t('related', { title: related.title, date: formatDateTime(related.createdAt) })}
          </span>
        ))}
        <span className='Notifications_time'>
          {t('since', { date: formatDateTime(notification.createdAt) })}
          {notification.resolvedAt && ` · ${t('resolvedAt', { date: formatDateTime(notification.resolvedAt) })}`}
        </span>
      </div>

      {isActive && (
        <div className='Notifications_actions'>
          {notification.monitorId && notification.kind === 'SERVICE_DOWN' && (
            <button
              type='button'
              onClick={() => checkMonitor(notification.monitorId!)}
              disabled={checkingId === notification.monitorId}
            >
              {checkingId === notification.monitorId ? t('checking') : t('checkNow')}
            </button>
          )}
          {notification.kind === 'AGENT_NOTICE' ? (
            <>
              <button type='button' onClick={() => navigate('/MyHomeLab/Projects?view=triggers')}>
                {t('openSchedules')}
              </button>
              <button type='button' onClick={() => void dismiss(notification.id)}>
                {t('dismiss')}
              </button>
            </>
          ) : appPage(notification) ? (
            <button type='button' onClick={() => navigate(appPage(notification)!)}>
              {t('openApp')}
            </button>
          ) : (
            <button type='button' onClick={() => navigate('/MyHomeLab/Servers')}>
              {t('openServices')}
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className='Notifications'>
      <header>
        <div className='Right_Side'>
          <span>{t('title')}</span>
          <Page_Help topic='services' />
        </div>
      </header>

      {!loading && active.length === 0 && (
        <div className='Notifications_empty'>
          <span className='Notifications_empty_title'>{t('allGood')}</span>
          <span>{t('allGoodText')}</span>
        </div>
      )}

      {asks.length > 0 && (
        <section className='Notifications_list'>
          <span className='Notifications_label'>{t('needsYou', { count: asks.length })}</span>
          {asks.map(renderAsk)}
        </section>
      )}

      {warnings.length > 0 && (
        <section className='Notifications_list'>
          <span className='Notifications_label'>{t('warnings', { count: warnings.length })}</span>
          {warnings.map((notification) => renderCard(notification, true))}
        </section>
      )}

      {resolved.length > 0 && (
        <section className='Notifications_list'>
          <div className='Notifications_resolved_head'>
            <button type='button' className='Notifications_toggle' onClick={() => setShowResolved(!showResolved)}>
              {showResolved ? '▾' : '▸'} {t('resolved', { count: resolved.length })}
            </button>
            {showResolved && (
              <button type='button' className='Notifications_clear' onClick={clearResolved}>
                {t('clearResolved')}
              </button>
            )}
          </div>
          {showResolved && resolved.map((notification) => renderCard(notification, false))}
        </section>
      )}
    </div>
  );
};

export default Notifications;
