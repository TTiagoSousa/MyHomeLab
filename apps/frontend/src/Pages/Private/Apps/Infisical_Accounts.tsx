import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import Infisical_Account_Modal from '../../../Components/Modals/Infisical_Account_Modal/Infisical_Account_Modal';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';

const Infisical_Accounts = () => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { connectedAccounts, fetchConnectedAccounts } = useConnectedAccounts('INFISICAL');
  const [connecting, setConnecting] = useState(false);

  return (
    <Apps_Page title={t('apps.infisical.title')} onAdd={() => setConnecting(true)} addLabel={t('apps.infisical.connect')}>
      {connectedAccounts.length ? (
        connectedAccounts.map((account) => (
          <Apps_Account_Card
            key={account.id}
            avatar={account.displayName ?? 'IN'}
            title={account.displayName ?? t('apps.infisical.title')}
            meta={account.appHost ?? ''}
            chips={
              account.appLatestVersion ? <span className='Apps_chip update'>{t('apps.infisical.updateChip', { version: account.appLatestVersion })}</span> : undefined
            }
            onOpen={() => navigate(`/MyHomeLab/Apps/Infisical/${account.id}`)}
          />
        ))
      ) : (
        <Apps_Empty_Card label={t('apps.infisical.connect')} onAdd={() => setConnecting(true)} />
      )}
      <p className='Apps_section_note'>{t('apps.infisical.agentsNote')}</p>

      {connecting && (
        <Infisical_Account_Modal
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

export default Infisical_Accounts;
