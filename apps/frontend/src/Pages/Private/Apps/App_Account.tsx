import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Apps_Section } from './appsShared';
import { formatRelativeTime } from './relativeTime';
import { dateLocale } from '../../../i18n';

export type App_Account_State = 'ok' | 'error' | 'checking' | 'off' | 'unknown';

interface App_Account_Props {
  icon: ReactNode;
  description: string;
  type: string;
  name: string;
  host?: string | null;
  user?: string | null;
  userLabel?: string;
  version?: string | null;
  latestVersion?: string | null;
  latestUrl?: string | null;
  state: App_Account_State;
  since?: string | null;
  checkedAt?: string | null;
  details?: ReactNode;
  location?: ReactNode;
  children?: ReactNode;
  checking?: boolean;
  onCheck?: () => void;
  actions?: ReactNode;
  footer?: ReactNode;
  removing?: boolean;
  onDisconnect?: () => void | Promise<void>;
}

const App_Account = ({
  icon,
  description,
  type,
  name,
  host,
  user,
  userLabel,
  version,
  latestVersion,
  latestUrl,
  state,
  since,
  checkedAt,
  details,
  location,
  children,
  checking,
  onCheck,
  actions,
  footer,
  removing,
  onDisconnect,
}: App_Account_Props) => {
  const { t } = useTranslation('addons');
  const [confirming, setConfirming] = useState(false);

  return (
    <Apps_Section id='app-account' icon={icon} title={t('apps.account.title')} description={description}>
      <dl className='Apps_details'>
        <dt>{t('apps.account.type')}</dt>
        <dd>{type}</dd>
        <dt>{t('apps.account.name')}</dt>
        <dd>{name}</dd>
        {host !== undefined && (
          <>
            <dt>{t('apps.account.address')}</dt>
            <dd>{host ?? '—'}</dd>
          </>
        )}
        {user !== undefined && (
          <>
            <dt>{userLabel ?? t('apps.account.user')}</dt>
            <dd>{user ?? '—'}</dd>
          </>
        )}
        {version !== undefined && (
          <>
            <dt>{t('apps.account.version')}</dt>
            <dd className='Apps_details_version'>
              <span>{version ?? (checking ? t('apps.loading') : '—')}</span>
              {latestVersion && (
                <>
                  <span className='Apps_chip update'>{t('apps.account.latest', { version: latestVersion })}</span>
                  {latestUrl && (
                    <a href={latestUrl} target='_blank' rel='noreferrer'>
                      {t('apps.account.releaseNotes')}
                    </a>
                  )}
                </>
              )}
            </dd>
          </>
        )}
        <dt>{t('apps.account.state')}</dt>
        <dd>
          <span className={`Apps_state ${state}`}>
            <span className='Apps_state_dot' />
            {t(`apps.account.states.${state}`)}
          </span>
        </dd>
        {since !== undefined && (
          <>
            <dt>{t('apps.account.since')}</dt>
            <dd>{since ? new Date(since).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</dd>
          </>
        )}
        {checkedAt !== undefined && (
          <>
            <dt>{t('apps.account.checkedAt')}</dt>
            <dd>{formatRelativeTime(checkedAt ?? null, t)}</dd>
          </>
        )}
        {details}
      </dl>

      {children}

      {location}

      {footer ?? (
        <div className='Apps_footer'>
          {onCheck && (
            <button type='button' onClick={onCheck} disabled={checking}>
              {checking ? t('apps.account.checking') : t('apps.account.check')}
            </button>
          )}
          {actions}
          {onDisconnect &&
            (confirming ? (
              <>
                <button type='button' onClick={() => setConfirming(false)} disabled={removing}>
                  {t('apps.cancel')}
                </button>
                <button type='button' className='danger' onClick={() => void onDisconnect()} disabled={removing}>
                  {t('apps.account.confirmDisconnect')}
                </button>
              </>
            ) : (
              <button type='button' className='danger' onClick={() => setConfirming(true)}>
                {t('apps.account.disconnect')}
              </button>
            ))}
        </div>
      )}
    </Apps_Section>
  );
};

export default App_Account;
