import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import Adguard_Account_Modal from '../../../Components/Modals/Adguard_Account_Modal/Adguard_Account_Modal';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';

const Adguard_Accounts = () => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { connectedAccounts, fetchConnectedAccounts } = useConnectedAccounts('ADGUARD');
  const [connecting, setConnecting] = useState(false);

  return (
    <Apps_Page title={t('apps.adguard.title')} onAdd={() => setConnecting(true)} addLabel={t('apps.adguard.connect')}>
      {connectedAccounts.length ? (
        connectedAccounts.map((account) => (
          <Apps_Account_Card
            key={account.id}
            avatar={account.displayName ?? 'AG'}
            title={account.displayName ?? 'AdGuard'}
            meta={[account.username, account.appHost].filter(Boolean).join(' · ')}
            chips={
              <>
                {account.appVersion && <span className='Apps_chip'>{account.appVersion}</span>}
                {account.appLatestVersion && (
                  <span className='Apps_chip update'>{t('apps.adguard.updateChip', { version: account.appLatestVersion })}</span>
                )}
              </>
            }
            onOpen={() => navigate(`/MyHomeLab/Apps/AdGuard/${account.id}`)}
          />
        ))
      ) : (
        <Apps_Empty_Card label={t('apps.adguard.connect')} onAdd={() => setConnecting(true)} />
      )}

      {connecting && (
        <Adguard_Account_Modal
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

export default Adguard_Accounts;
