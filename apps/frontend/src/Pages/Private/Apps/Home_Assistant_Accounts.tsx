import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import Home_Assistant_Account_Modal from '../../../Components/Modals/Home_Assistant_Account_Modal/Home_Assistant_Account_Modal';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';

const Home_Assistant_Accounts = () => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { connectedAccounts, fetchConnectedAccounts } = useConnectedAccounts('HOME_ASSISTANT');
  const [connecting, setConnecting] = useState(false);

  return (
    <Apps_Page title={t('apps.homeAssistant.title')} onAdd={() => setConnecting(true)} addLabel={t('apps.homeAssistant.connect')}>
      {connectedAccounts.length ? (
        connectedAccounts.map((account) => (
          <Apps_Account_Card
            key={account.id}
            avatar={account.displayName ?? 'HA'}
            title={account.displayName ?? 'Home Assistant'}
            meta={[account.username, account.appHost].filter(Boolean).join(' · ')}
            chips={
              <>
                {account.appVersion && <span className='Apps_chip'>{account.appVersion}</span>}
                {account.appLatestVersion && (
                  <span className='Apps_chip update'>{t('apps.homeAssistant.updateChip', { version: account.appLatestVersion })}</span>
                )}
              </>
            }
            onOpen={() => navigate(`/MyHomeLab/Apps/HomeAssistant/${account.id}`)}
          />
        ))
      ) : (
        <Apps_Empty_Card label={t('apps.homeAssistant.connect')} onAdd={() => setConnecting(true)} />
      )}

      {connecting && (
        <Home_Assistant_Account_Modal
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

export default Home_Assistant_Accounts;
