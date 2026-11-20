import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import Dispatcharr_Account_Modal from '../../../Components/Modals/Dispatcharr_Account_Modal/Dispatcharr_Account_Modal';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';

const Dispatcharr_Accounts = () => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { connectedAccounts, fetchConnectedAccounts } = useConnectedAccounts('DISPATCHARR');
  const [connecting, setConnecting] = useState(false);

  return (
    <Apps_Page title={t('apps.dispatcharr.title')} onAdd={() => setConnecting(true)} addLabel={t('apps.dispatcharr.connect')}>
      {connectedAccounts.length ? (
        connectedAccounts.map((account) => (
          <Apps_Account_Card
            key={account.id}
            avatar={account.displayName ?? 'DI'}
            title={account.displayName ?? t('apps.dispatcharr.title')}
            meta={account.appHost ?? ''}
            chips={
              account.appLatestVersion ? <span className='Apps_chip update'>{t('apps.dispatcharr.updateChip', { version: account.appLatestVersion })}</span> : undefined
            }
            onOpen={() => navigate(`/MyHomeLab/Apps/Dispatcharr/${account.id}`)}
          />
        ))
      ) : (
        <Apps_Empty_Card label={t('apps.dispatcharr.connect')} onAdd={() => setConnecting(true)} />
      )}
      <p className='Apps_section_note'>{t('apps.dispatcharr.agentsNote')}</p>

      {connecting && (
        <Dispatcharr_Account_Modal
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

export default Dispatcharr_Accounts;
