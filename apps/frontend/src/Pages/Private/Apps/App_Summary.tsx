import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import './App_Summary.scss';
import type { App_Account_State } from './App_Account';
import { Apps_Hint } from './appsShared';
import { formatRelativeTime } from './relativeTime';
import { dateLocale } from '../../../i18n';

export interface App_Summary_Fact {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}

interface App_Summary_Props {
  icon: ReactNode;
  state: App_Account_State;
  host?: string | null;
  user?: string | null;
  since?: string | null;
  checkedAt?: string | null;
  version?: string | null;
  latestVersion?: string | null;
  latestUrl?: string | null;
  facts?: App_Summary_Fact[];
  checking?: boolean;
  onCheck?: () => void;
  onOpenAccount: () => void;
  children?: ReactNode;
}

const Summary_Fact = ({ label, value, hint }: App_Summary_Fact) => (
  <div className='App_Summary_Fact'>
    <span className='App_Summary_Label'>{label}</span>
    <span className='App_Summary_Value'>
      <Apps_Hint hint={hint}>{value}</Apps_Hint>
    </span>
  </div>
);

const App_Summary = ({
  icon,
  state,
  host,
  user,
  since,
  checkedAt,
  version,
  latestVersion,
  latestUrl,
  facts = [],
  checking,
  onCheck,
  onOpenAccount,
  children,
}: App_Summary_Props) => {
  const { t } = useTranslation('addons');

  const accountHint = (
    <>
      {user && <span className='App_Summary_Line'>{t('apps.summary.user', { user })}</span>}
      {since && (
        <span className='App_Summary_Line'>
          {t('apps.summary.since', { date: new Date(since).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) })}
        </span>
      )}
      <span className='App_Summary_Line'>{t('apps.summary.accountHint')}</span>
    </>
  );

  const versionValue = (
    <span className='App_Summary_Version'>
      <span className={latestVersion ? 'old' : ''}>{version ?? (checking ? t('apps.loading') : '—')}</span>
      {latestVersion && <span className='Apps_chip update'>→ {latestVersion}</span>}
    </span>
  );

  return (
    <section className='Apps_section App_Summary' id='app-summary'>
      <div className='App_Summary_Head'>
        <span className='App_Summary_Icon'>{icon}</span>
        <div className='App_Summary_Text'>
          <Apps_Hint hint={accountHint}>
            <span className='App_Summary_Host'>{host ?? '—'}</span>
          </Apps_Hint>
          <span className='App_Summary_Checked'>{t('apps.summary.checked', { when: formatRelativeTime(checkedAt ?? null, t) })}</span>
        </div>
        <div className='App_Summary_Actions'>
          {onCheck && (
            <button type='button' onClick={onCheck} disabled={checking}>
              {checking ? t('apps.account.checking') : t('apps.account.check')}
            </button>
          )}
          <button type='button' onClick={onOpenAccount}>
            {t('apps.summary.account')}
          </button>
        </div>
      </div>

      <div className='App_Summary_Facts'>
        <Summary_Fact
          label={t('apps.account.state')}
          hint={t(`apps.summary.stateHint.${state}`)}
          value={
            <span className={`Apps_state ${state}`}>
              <span className='Apps_state_dot' />
              {t(`apps.account.states.${state}`)}
            </span>
          }
        />
        {version !== undefined && (
          <div className='App_Summary_Fact'>
            <span className='App_Summary_Label'>{t('apps.account.version')}</span>
            <span className='App_Summary_Value'>
              <Apps_Hint hint={latestVersion ? t('apps.summary.versionNew', { version: latestVersion }) : version ? t('apps.summary.versionOk') : undefined}>
                {versionValue}
              </Apps_Hint>
            </span>
            {latestUrl && latestVersion && (
              <a className='App_Summary_Link' href={latestUrl} target='_blank' rel='noreferrer'>
                {t('apps.account.releaseNotes')}
              </a>
            )}
          </div>
        )}
        {facts.map((fact) => (
          <Summary_Fact key={fact.label} {...fact} />
        ))}
      </div>

      {children}
    </section>
  );
};

export default App_Summary;
