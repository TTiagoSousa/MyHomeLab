import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import OpenGym_Account_Modal from '../../../Components/Modals/OpenGym_Account_Modal/OpenGym_Account_Modal';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';

const OpenGym_Accounts = () => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { connectedAccounts, fetchConnectedAccounts } = useConnectedAccounts('OPENGYM');
  const [connecting, setConnecting] = useState(false);

  return (
    <Apps_Page title={t('apps.openGym.title')} onAdd={() => setConnecting(true)} addLabel={t('apps.openGym.connect')}>
      {connectedAccounts.length ? (
        connectedAccounts.map((account) => (
          <Apps_Account_Card
            key={account.id}
            avatar={account.displayName ?? 'OG'}
            title={account.displayName ?? t('apps.openGym.title')}
            meta={account.appHost ?? ''}
            chips={
              account.appLatestVersion ? <span className='Apps_chip update'>{t('apps.openGym.updateChip', { version: account.appLatestVersion })}</span> : undefined
            }
            onOpen={() => navigate(`/MyHomeLab/Apps/OpenGym/${account.id}`)}
          />
        ))
      ) : (
        <Apps_Empty_Card label={t('apps.openGym.connect')} onAdd={() => setConnecting(true)} />
      )}
      <p className='Apps_section_note'>{t('apps.openGym.agentsNote')}</p>

      {connecting && (
        <OpenGym_Account_Modal
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

export default OpenGym_Accounts;
