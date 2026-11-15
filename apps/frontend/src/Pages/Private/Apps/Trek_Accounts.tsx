import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import Trek_Account_Modal from '../../../Components/Modals/Trek_Account_Modal/Trek_Account_Modal';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';

const Trek_Accounts = () => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { connectedAccounts, fetchConnectedAccounts } = useConnectedAccounts('TREK');
  const [connecting, setConnecting] = useState(false);

  return (
    <Apps_Page title={t('apps.trek.title')} onAdd={() => setConnecting(true)} addLabel={t('apps.trek.connect')}>
      {connectedAccounts.length ? (
        connectedAccounts.map((account) => (
          <Apps_Account_Card
            key={account.id}
            avatar={account.displayName ?? account.username ?? 'TR'}
            title={account.displayName ?? account.username ?? 'TREK'}
            meta={[account.username, account.appHost].filter(Boolean).join(' · ')}
            chips={
              <>
                {account.appVersion && <span className='Apps_chip'>{account.appVersion}</span>}
                {account.appLatestVersion && (
                  <span className='Apps_chip update'>{t('apps.trek.updateChip', { version: account.appLatestVersion })}</span>
                )}
              </>
            }
            onOpen={() => navigate(`/MyHomeLab/Apps/Trek/${account.id}`)}
          />
        ))
      ) : (
        <Apps_Empty_Card label={t('apps.trek.connect')} onAdd={() => setConnecting(true)} />
      )}

      {connecting && (
        <Trek_Account_Modal
          onClose={() => setConnecting(false)}
          onSaved={() => {
            setConnecting(false);
            fetchConnectedAccounts();
          }}
        />
      )}
    </Apps_Page>
  );
};

export default Trek_Accounts;
