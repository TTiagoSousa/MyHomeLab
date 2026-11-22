import '../Apps/Apps.scss';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useConnectedAccounts, type ConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import { useGoogleConnectResult } from '../../../Hooks/ConnectedAccount/useGoogleConnectResult';
import { useEmailRules } from '../../../Hooks/EmailRule/useEmailRules';
import { useRuleProposals } from '../../../Hooks/EmailRule/useRuleProposals';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from '../Apps/appsShared';
import { formatRelativeTime } from '../Apps/relativeTime';

const Gmail_Card = ({ account, onReconnect }: { account: ConnectedAccount; onReconnect: () => void }) => {
  const { t } = useTranslation('email');
  const { t: tAddons } = useTranslation('addons');
  const navigate = useNavigate();
  const { emailRules } = useEmailRules(account.id);
  const { pending: proposals } = useRuleProposals(account.id);

  return (
    <Apps_Account_Card
      avatar={account.emailAddress ?? '?'}
      title={account.emailAddress ?? t('account.fallbackTitle')}
      meta={t('account.meta', {
        rules: t('account.rules', { count: emailRules.length }),
        lastRun: formatRelativeTime(account.lastRunAt, t),
      })}
      chips={
        (!account.isActive || proposals.length > 0) && <>
          {!account.isActive && <span className='Apps_chip off'>{tAddons('google.reconnectChip')}</span>}
          {proposals.length > 0 && <span className='Apps_chip update'>{t('account.pendingProposals', { count: proposals.length })}</span>}
        </>
      }
      actions={
        <>
          {!account.isActive && (
            <button type='button' className='danger' onClick={onReconnect}>
              {tAddons('google.reconnect')}
            </button>
          )}
          <button type='button' onClick={() => navigate(`/MyHomeLab/Apps/Gmail/Rules?account=${account.id}`)}>
            {t('account.viewRules')}
          </button>
        </>
      }
      onOpen={() => navigate(`/MyHomeLab/Apps/Gmail/${account.id}`)}
    />
  );
};

const Email = () => {
  const { t } = useTranslation('email');
  const navigate = useNavigate();
  const { connectedAccounts } = useConnectedAccounts('GMAIL');
  const { connectGoogleAccount } = useConnectedAccount();
  useGoogleConnectResult();

  return (
    <Apps_Page
      title={t('page.title')}
      actions={
        connectedAccounts.length > 0 && (
          <>
            <button type='button' className='Apps_header_button' onClick={() => navigate('/MyHomeLab/Apps/Gmail/Connections')}>
              {t('page.connections')}
            </button>
            <button type='button' className='Apps_header_button' onClick={() => navigate('/MyHomeLab/Apps/Gmail/Rules')}>
              {t('page.allRules')}
            </button>
          </>
        )
      }
      onAdd={connectGoogleAccount}
      addLabel={t('page.connect')}
    >
      {connectedAccounts.length ? (
        connectedAccounts.map((account) => <Gmail_Card key={account.id} account={account} onReconnect={connectGoogleAccount} />)
      ) : (
        <Apps_Empty_Card label={t('page.connect')} onAdd={connectGoogleAccount} />
      )}
    </Apps_Page>
  );
};

export default Email;
