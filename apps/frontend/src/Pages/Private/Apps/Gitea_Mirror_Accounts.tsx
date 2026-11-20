import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import Gitea_Mirror_Account_Modal from '../../../Components/Modals/Gitea_Mirror_Account_Modal/Gitea_Mirror_Account_Modal';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';

const Gitea_Mirror_Accounts = () => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { connectedAccounts, fetchConnectedAccounts } = useConnectedAccounts('GITEA_MIRROR');
  const [connecting, setConnecting] = useState(false);

  return (
    <Apps_Page title={t('apps.giteaMirror.title')} onAdd={() => setConnecting(true)} addLabel={t('apps.giteaMirror.connect')}>
      {connectedAccounts.length ? (
        connectedAccounts.map((account) => (
          <Apps_Account_Card
            key={account.id}
            avatar={account.displayName ?? 'GM'}
            title={account.displayName ?? t('apps.giteaMirror.title')}
            meta={account.appHost ?? ''}
            chips={
              account.appLatestVersion ? <span className='Apps_chip update'>{t('apps.giteaMirror.updateChip', { version: account.appLatestVersion })}</span> : undefined
            }
            onOpen={() => navigate(`/MyHomeLab/Apps/GiteaMirror/${account.id}`)}
          />
        ))
      ) : (
        <Apps_Empty_Card label={t('apps.giteaMirror.connect')} onAdd={() => setConnecting(true)} />
      )}
      <p className='Apps_section_note'>{t('apps.giteaMirror.agentsNote')}</p>

      {connecting && (
        <Gitea_Mirror_Account_Modal
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

export default Gitea_Mirror_Accounts;
