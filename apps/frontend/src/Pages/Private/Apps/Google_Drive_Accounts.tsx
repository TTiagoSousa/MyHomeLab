import './Apps.scss';
import './Google_Drive.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import { useBoardProjects } from '../../../Hooks/Board/useBoardProjects';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';
import Google_Drive_Links from './Google_Drive_Links';

const Google_Drive_Accounts = () => {
  const { t } = useTranslation('addons');
  const { connectedAccounts, fetchConnectedAccounts } = useConnectedAccounts('GOOGLE_DRIVE');
  const { connectGoogleDriveAccount, deleteConnectedAccount, loading } = useConnectedAccount();
  const { projects } = useBoardProjects();
  const [confirming, setConfirming] = useState('');

  const disconnect = async (id: string) => {
    if (confirming !== id) {
      setConfirming(id);
      return;
    }
    setConfirming('');
    if (await deleteConnectedAccount(id)) fetchConnectedAccounts();
  };

  return (
    <Apps_Page title={t('apps.googleDrive.title')} onAdd={connectGoogleDriveAccount} addLabel={t('apps.googleDrive.connect')}>
      {connectedAccounts.length ? (
        <>
          {connectedAccounts.map((account) => (
            <Apps_Account_Card
              key={account.id}
              avatar={account.emailAddress ?? 'GD'}
              title={account.emailAddress ?? t('apps.googleDrive.title')}
              meta={t('apps.googleDrive.meta')}
              actions={
                <button type='button' className={confirming === account.id ? 'danger' : ''} disabled={loading} onClick={() => void disconnect(account.id)}>
                  {confirming === account.id ? t('apps.googleDrive.confirmDisconnect') : t('apps.googleDrive.disconnect')}
                </button>
              }
              onOpen={() => window.open('https://drive.google.com/', '_blank', 'noopener')}
            />
          ))}
          {connectedAccounts.map((account) => (
            <Google_Drive_Links
              key={`links-${account.id}`}
              accountId={account.id}
              email={account.emailAddress ?? null}
              showEmail={connectedAccounts.length > 1}
              projects={projects}
            />
          ))}
        </>
      ) : (
        <Apps_Empty_Card label={t('apps.googleDrive.connect')} onAdd={connectGoogleDriveAccount} />
      )}
    </Apps_Page>
  );
};

export default Google_Drive_Accounts;
