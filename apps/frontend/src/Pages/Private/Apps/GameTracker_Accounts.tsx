import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import GameTracker_Account_Modal from '../../../Components/Modals/GameTracker_Account_Modal/GameTracker_Account_Modal';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';

const GameTracker_Accounts = () => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { connectedAccounts, fetchConnectedAccounts } = useConnectedAccounts('GAMETRACKER');
  const [connecting, setConnecting] = useState(false);

  return (
    <Apps_Page title={t('apps.gameTracker.title')} onAdd={() => setConnecting(true)} addLabel={t('apps.gameTracker.connect')}>
      {connectedAccounts.length ? (
        connectedAccounts.map((account) => (
          <Apps_Account_Card
            key={account.id}
            avatar={account.displayName ?? 'GT'}
            title={account.displayName ?? t('apps.gameTracker.title')}
            meta={account.appHost ?? ''}
            chips={
              account.appLatestVersion ? <span className='Apps_chip update'>{t('apps.gameTracker.updateChip', { version: account.appLatestVersion })}</span> : undefined
            }
            onOpen={() => navigate(`/MyHomeLab/Apps/GameTracker/${account.id}`)}
          />
        ))
      ) : (
        <Apps_Empty_Card label={t('apps.gameTracker.connect')} onAdd={() => setConnecting(true)} />
      )}
      <p className='Apps_section_note'>{t('apps.gameTracker.agentsNote')}</p>

      {connecting && (
        <GameTracker_Account_Modal
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

export default GameTracker_Accounts;
