import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import Forgejo_Account_Modal from '../../../Components/Modals/Forgejo_Account_Modal/Forgejo_Account_Modal';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';

const Forgejo_Accounts = () => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { connectedAccounts, fetchConnectedAccounts } = useConnectedAccounts('FORGEJO');
  const [connecting, setConnecting] = useState(false);

  return (
    <Apps_Page title={t('apps.forgejo.title')} onAdd={() => setConnecting(true)} addLabel={t('apps.forgejo.connect')}>
      {connectedAccounts.length ? (
        connectedAccounts.map((account) => (
          <Apps_Account_Card
            key={account.id}
            avatar={account.displayName ?? account.username ?? 'FG'}
            title={account.displayName ?? account.username ?? 'Forgejo'}
            meta={[account.username, account.forgejoHost].filter(Boolean).join(' · ')}
            chips={
              <>
                <span className={`Apps_chip${account.isAdmin ? ' on' : ''}`}>
                  {account.isAdmin ? t('apps.forgejo.admin') : t('apps.forgejo.notAdmin')}
                </span>
                {account.appLatestVersion && (
                  <span className='Apps_chip update'>{t('apps.forgejo.updateChip', { version: account.appLatestVersion })}</span>
                )}
              </>
            }
            onOpen={() => navigate(`/MyHomeLab/Apps/Forgejo/${account.id}`)}
          />
        ))
      ) : (
        <Apps_Empty_Card label={t('apps.forgejo.connect')} onAdd={() => setConnecting(true)} />
      )}
      <p className='Apps_section_note'>{t('apps.forgejo.agentsNote')}</p>

      {connecting && (
        <Forgejo_Account_Modal
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

export default Forgejo_Accounts;
