import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import ClickHouse_Account_Modal from '../../../Components/Modals/ClickHouse_Account_Modal/ClickHouse_Account_Modal';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';

const ClickHouse_Accounts = () => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { connectedAccounts, fetchConnectedAccounts } = useConnectedAccounts('CLICKHOUSE');
  const [connecting, setConnecting] = useState(false);

  return (
    <Apps_Page title={t('apps.clickhouse.title')} onAdd={() => setConnecting(true)} addLabel={t('apps.clickhouse.connect')}>
      {connectedAccounts.length ? (
        connectedAccounts.map((account) => (
          <Apps_Account_Card
            key={account.id}
            avatar={account.displayName ?? 'CH'}
            title={account.displayName ?? t('apps.clickhouse.title')}
            meta={account.appHost ?? ''}
            chips={
              account.appLatestVersion ? <span className='Apps_chip update'>{t('apps.clickhouse.updateChip', { version: account.appLatestVersion })}</span> : undefined
            }
            onOpen={() => navigate(`/MyHomeLab/Apps/ClickHouse/${account.id}`)}
          />
        ))
      ) : (
        <Apps_Empty_Card label={t('apps.clickhouse.connect')} onAdd={() => setConnecting(true)} />
      )}
      <p className='Apps_section_note'>{t('apps.clickhouse.agentsNote')}</p>

      {connecting && (
        <ClickHouse_Account_Modal
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

export default ClickHouse_Accounts;
