import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import Solidtime_Account_Modal from '../../../Components/Modals/Solidtime_Account_Modal/Solidtime_Account_Modal';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';

const Solidtime_Accounts = () => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { connectedAccounts, fetchConnectedAccounts } = useConnectedAccounts('SOLIDTIME');
  const [connecting, setConnecting] = useState(false);

  return (
    <Apps_Page title={t('apps.solidtime.title')} onAdd={() => setConnecting(true)} addLabel={t('apps.solidtime.connect')}>
      {connectedAccounts.length ? (
        connectedAccounts.map((account) => (
          <Apps_Account_Card
            key={account.id}
            avatar={account.displayName ?? 'ST'}
            title={account.displayName ?? t('apps.solidtime.title')}
            meta={account.appHost ?? ''}
            chips={
              account.appLatestVersion ? <span className='Apps_chip update'>{t('apps.solidtime.updateChip', { version: account.appLatestVersion })}</span> : undefined
            }
            onOpen={() => navigate(`/MyHomeLab/Apps/Solidtime/${account.id}`)}
          />
        ))
      ) : (
        <Apps_Empty_Card label={t('apps.solidtime.connect')} onAdd={() => setConnecting(true)} />
      )}
      <p className='Apps_section_note'>{t('apps.solidtime.agentsNote')}</p>

      {connecting && (
        <Solidtime_Account_Modal
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

export default Solidtime_Accounts;
