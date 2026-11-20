import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import Vaultwarden_Account_Modal from '../../../Components/Modals/Vaultwarden_Account_Modal/Vaultwarden_Account_Modal';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';

const Vaultwarden_Accounts = () => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { connectedAccounts, fetchConnectedAccounts } = useConnectedAccounts('VAULTWARDEN');
  const [connecting, setConnecting] = useState(false);

  return (
    <Apps_Page title={t('apps.vaultwarden.title')} onAdd={() => setConnecting(true)} addLabel={t('apps.vaultwarden.connect')}>
      {connectedAccounts.length ? (
        connectedAccounts.map((account) => (
          <Apps_Account_Card
            key={account.id}
            avatar={account.displayName ?? 'VW'}
            title={account.displayName ?? t('apps.vaultwarden.title')}
            meta={account.appHost ?? ''}
            chips={
              account.appLatestVersion ? <span className='Apps_chip update'>{t('apps.vaultwarden.updateChip', { version: account.appLatestVersion })}</span> : undefined
            }
            onOpen={() => navigate(`/MyHomeLab/Apps/Vaultwarden/${account.id}`)}
          />
        ))
      ) : (
        <Apps_Empty_Card label={t('apps.vaultwarden.connect')} onAdd={() => setConnecting(true)} />
      )}
      <p className='Apps_section_note'>{t('apps.vaultwarden.agentsNote')}</p>

      {connecting && (
        <Vaultwarden_Account_Modal
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

export default Vaultwarden_Accounts;
