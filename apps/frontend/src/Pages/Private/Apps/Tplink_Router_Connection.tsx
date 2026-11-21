import { useTranslation } from 'react-i18next';
import type { TplinkConnection } from '../../../Hooks/ConnectedAccount/useTplinkRouterStatus';
import { formatClockTime } from './tplinkRouterFormat';
import { formatRelativeTime } from './relativeTime';
import * as Icon from '../../../Imports/icons';

interface Tplink_Router_Connection_Props {
  connection: TplinkConnection;
  checking: boolean;
  onConnect: () => void;
  onOpenAccount: () => void;
}

const Tplink_Router_Connection = ({ connection, checking, onConnect, onOpenAccount }: Tplink_Router_Connection_Props) => {
  const { t } = useTranslation('addons');
  const failed = connection.state === 'failed';

  return (
    <div className={`Tplink_Router_Connection ${connection.state}`}>
      <span className='Tplink_Router_Connection_Icon'>{failed ? <Icon.Shield /> : <Icon.Refresh />}</span>
      <div className='Tplink_Router_Connection_Text'>
        <span className='Tplink_Router_Connection_Title'>
          {failed
            ? t(`apps.tplinkRouter.connection.failedTitle.${connection.kind ?? 'router'}`)
            : t(`apps.tplinkRouter.connection.disconnectedTitle.${connection.kind ?? 'router'}`)}
        </span>
        {connection.message && <span className='Tplink_Router_Connection_Reason'>{connection.message}</span>}
        <span className='Tplink_Router_Connection_Hint'>
          {failed
            ? t('apps.tplinkRouter.connection.failedHint')
            : connection.nextRetryAt
              ? t('apps.tplinkRouter.connection.retryAt', { time: formatClockTime(connection.nextRetryAt) })
              : t('apps.tplinkRouter.connection.retrySoon')}
        </span>
        <span className='Tplink_Router_Connection_Since'>{t('apps.tplinkRouter.connection.since', { when: formatRelativeTime(connection.since, t) })}</span>
      </div>
      <div className='Tplink_Router_Connection_Actions'>
        {failed && (
          <button type='button' onClick={onOpenAccount}>
            {t('apps.tplinkRouter.connection.openAccount')}
          </button>
        )}
        <button type='button' className='primary' onClick={onConnect} disabled={checking}>
          {checking ? t('apps.tplinkRouter.connection.connecting') : t('apps.tplinkRouter.connection.connectNow')}
        </button>
      </div>
    </div>
  );
};

export default Tplink_Router_Connection;
