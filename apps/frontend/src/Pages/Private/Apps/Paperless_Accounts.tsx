import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import Paperless_Account_Modal from '../../../Components/Modals/Paperless_Account_Modal/Paperless_Account_Modal';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';

const Paperless_Accounts = () => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { connectedAccounts, fetchConnectedAccounts } = useConnectedAccounts('PAPERLESS');
  const [connecting, setConnecting] = useState(false);

  return (
    <Apps_Page title={t('apps.paperless.title')} onAdd={() => setConnecting(true)} addLabel={t('apps.paperless.connect')}>
      {connectedAccounts.length ? (
        connectedAccounts.map((account) => (
          <Apps_Account_Card
            key={account.id}
            avatar={account.displayName ?? 'PL'}
            title={account.displayName ?? t('apps.paperless.title')}
            meta={account.appHost ?? ''}
            chips={
              account.appLatestVersion ? <span className='Apps_chip update'>{t('apps.paperless.updateChip', { version: account.appLatestVersion })}</span> : undefined
            }
            onOpen={() => navigate(`/MyHomeLab/Apps/Paperless/${account.id}`)}
          />
        ))
      ) : (
        <Apps_Empty_Card label={t('apps.paperless.connect')} onAdd={() => setConnecting(true)} />
      )}
      <p className='Apps_section_note'>{t('apps.paperless.agentsNote')}</p>

      {connecting && (
        <Paperless_Account_Modal
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

export default Paperless_Accounts;
