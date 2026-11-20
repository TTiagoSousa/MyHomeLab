import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import Coolify_Account_Modal from '../../../Components/Modals/Coolify_Account_Modal/Coolify_Account_Modal';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';

const Coolify_Accounts = () => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { connectedAccounts, fetchConnectedAccounts } = useConnectedAccounts('COOLIFY');
  const [connecting, setConnecting] = useState(false);

  return (
    <Apps_Page title={t('apps.coolify.title')} onAdd={() => setConnecting(true)} addLabel={t('apps.coolify.connect')}>
      {connectedAccounts.length ? (
        connectedAccounts.map((account) => (
          <Apps_Account_Card
            key={account.id}
            avatar={account.displayName ?? 'CO'}
            title={account.displayName ?? t('apps.coolify.title')}
            meta={account.appHost ?? ''}
            chips={
              account.appLatestVersion ? <span className='Apps_chip update'>{t('apps.coolify.updateChip', { version: account.appLatestVersion })}</span> : undefined
            }
            onOpen={() => navigate(`/MyHomeLab/Apps/Coolify/${account.id}`)}
          />
        ))
      ) : (
        <Apps_Empty_Card label={t('apps.coolify.connect')} onAdd={() => setConnecting(true)} />
      )}
      <p className='Apps_section_note'>{t('apps.coolify.agentsNote')}</p>

      {connecting && (
        <Coolify_Account_Modal
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

export default Coolify_Accounts;
