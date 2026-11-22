import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import { useGoogleConnectResult } from '../../../Hooks/ConnectedAccount/useGoogleConnectResult';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';

const Google_Tasks_Accounts = () => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { connectedAccounts, fetchConnectedAccounts } = useConnectedAccounts('GOOGLE_TASKS');
  const { connectGoogleTasksAccount, deleteConnectedAccount, loading } = useConnectedAccount();
  const [confirming, setConfirming] = useState('');
  useGoogleConnectResult();

  const disconnect = async (id: string) => {
    if (confirming !== id) {
      setConfirming(id);
      return;
    }
    setConfirming('');
    if (await deleteConnectedAccount(id)) fetchConnectedAccounts();
  };

  return (
    <Apps_Page
      title={t('apps.googleTasks.title')}
      actions={
        connectedAccounts.length > 0 && (
          <button type='button' className='Apps_header_button' onClick={() => navigate('/MyHomeLab/Apps/GoogleTasks/Connections')}>
            {t('apps.googleTasks.connections.title')}
          </button>
        )
      }
      onAdd={connectGoogleTasksAccount}
      addLabel={t('apps.googleTasks.connect')}
    >
      {connectedAccounts.length ? (
        connectedAccounts.map((account) => (
          <Apps_Account_Card
            key={account.id}
            avatar={account.emailAddress ?? 'GT'}
            title={account.emailAddress ?? t('apps.googleTasks.title')}
            meta={t('apps.googleTasks.meta')}
            chips={!account.isActive && <span className='Apps_chip off'>{t('google.reconnectChip')}</span>}
            actions={
              <>
                {!account.isActive && (
                  <button type='button' className='danger' onClick={connectGoogleTasksAccount}>
                    {t('google.reconnect')}
                  </button>
                )}
                <button type='button' className={confirming === account.id ? 'danger' : ''} disabled={loading} onClick={() => void disconnect(account.id)}>
                  {confirming === account.id ? t('apps.googleTasks.confirmDisconnect') : t('apps.googleTasks.disconnect')}
                </button>
              </>
            }
            onOpen={() => navigate('/MyHomeLab/Tasks?sync=1')}
          />
        ))
      ) : (
        <Apps_Empty_Card label={t('apps.googleTasks.connect')} onAdd={connectGoogleTasksAccount} />
      )}
    </Apps_Page>
  );
};

export default Google_Tasks_Accounts;
