import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import Postgres_Account_Modal from '../../../Components/Modals/Postgres_Account_Modal/Postgres_Account_Modal';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';

const Postgres_Accounts = () => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { connectedAccounts, fetchConnectedAccounts } = useConnectedAccounts('POSTGRES');
  const [connecting, setConnecting] = useState(false);

  return (
    <Apps_Page title={t('apps.postgres.title')} onAdd={() => setConnecting(true)} addLabel={t('apps.postgres.connect')}>
      {connectedAccounts.length ? (
        connectedAccounts.map((account) => (
          <Apps_Account_Card
            key={account.id}
            avatar={account.displayName ?? 'PG'}
            title={account.displayName ?? t('apps.postgres.title')}
            meta={account.appHost ?? ''}
            chips={
              account.appLatestVersion ? <span className='Apps_chip update'>{t('apps.postgres.updateChip', { version: account.appLatestVersion })}</span> : undefined
            }
            onOpen={() => navigate(`/MyHomeLab/Apps/Postgres/${account.id}`)}
          />
        ))
      ) : (
        <Apps_Empty_Card label={t('apps.postgres.connect')} onAdd={() => setConnecting(true)} />
      )}
      <p className='Apps_section_note'>{t('apps.postgres.agentsNote')}</p>

      {connecting && (
        <Postgres_Account_Modal
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

export default Postgres_Accounts;
