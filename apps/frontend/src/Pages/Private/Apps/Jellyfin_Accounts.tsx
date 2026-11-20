import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import Jellyfin_Account_Modal from '../../../Components/Modals/Jellyfin_Account_Modal/Jellyfin_Account_Modal';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';

const Jellyfin_Accounts = () => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { connectedAccounts, fetchConnectedAccounts } = useConnectedAccounts('JELLYFIN');
  const [connecting, setConnecting] = useState(false);

  return (
    <Apps_Page title={t('apps.jellyfin.title')} onAdd={() => setConnecting(true)} addLabel={t('apps.jellyfin.connect')}>
      {connectedAccounts.length ? (
        connectedAccounts.map((account) => (
          <Apps_Account_Card
            key={account.id}
            avatar={account.displayName ?? 'JF'}
            title={account.displayName ?? t('apps.jellyfin.title')}
            meta={account.appHost ?? ''}
            chips={
              account.appLatestVersion ? <span className='Apps_chip update'>{t('apps.jellyfin.updateChip', { version: account.appLatestVersion })}</span> : undefined
            }
            onOpen={() => navigate(`/MyHomeLab/Apps/Jellyfin/${account.id}`)}
          />
        ))
      ) : (
        <Apps_Empty_Card label={t('apps.jellyfin.connect')} onAdd={() => setConnecting(true)} />
      )}
      <p className='Apps_section_note'>{t('apps.jellyfin.agentsNote')}</p>

      {connecting && (
        <Jellyfin_Account_Modal
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

export default Jellyfin_Accounts;
