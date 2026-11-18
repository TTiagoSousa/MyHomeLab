import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import Stirling_Account_Modal from '../../../Components/Modals/Stirling_Account_Modal/Stirling_Account_Modal';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';

const Stirling_Accounts = () => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { connectedAccounts, fetchConnectedAccounts } = useConnectedAccounts('STIRLING_PDF');
  const [connecting, setConnecting] = useState(false);

  return (
    <Apps_Page title={t('apps.stirling.title')} onAdd={() => setConnecting(true)} addLabel={t('apps.stirling.connect')}>
      {connectedAccounts.length ? (
        connectedAccounts.map((account) => (
          <Apps_Account_Card
            key={account.id}
            avatar={account.displayName ?? 'SP'}
            title={account.displayName ?? t('apps.stirling.title')}
            meta={account.appHost ?? ''}
            chips={
              account.appLatestVersion ? <span className='Apps_chip update'>{t('apps.stirling.updateChip', { version: account.appLatestVersion })}</span> : undefined
            }
            onOpen={() => navigate(`/MyHomeLab/Apps/StirlingPDF/${account.id}`)}
          />
        ))
      ) : (
        <Apps_Empty_Card label={t('apps.stirling.connect')} onAdd={() => setConnecting(true)} />
      )}
      <p className='Apps_section_note'>{t('apps.stirling.agentsNote')}</p>

      {connecting && (
        <Stirling_Account_Modal
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

export default Stirling_Accounts;
