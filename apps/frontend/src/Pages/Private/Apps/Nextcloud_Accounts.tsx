import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import Nextcloud_Account_Modal from '../../../Components/Modals/Nextcloud_Account_Modal/Nextcloud_Account_Modal';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';

const Nextcloud_Accounts = () => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { connectedAccounts, fetchConnectedAccounts } = useConnectedAccounts('NEXTCLOUD');
  const [connecting, setConnecting] = useState(false);

  return (
    <Apps_Page title={t('apps.nextcloud.title')} onAdd={() => setConnecting(true)} addLabel={t('apps.nextcloud.connect')}>
      {connectedAccounts.length ? (
        connectedAccounts.map((account) => (
          <Apps_Account_Card
            key={account.id}
            avatar={account.displayName ?? 'NC'}
            title={account.displayName ?? 'Nextcloud'}
            meta={[account.caldavUsername, account.caldavHost].filter(Boolean).join(' · ')}
            onOpen={() => navigate(`/MyHomeLab/Apps/Nextcloud/${account.id}`)}
          />
        ))
      ) : (
        <Apps_Empty_Card label={t('apps.nextcloud.connect')} onAdd={() => setConnecting(true)} />
      )}

      {connecting && (
        <Nextcloud_Account_Modal
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

export default Nextcloud_Accounts;
