import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import Nginx_Proxy_Manager_Account_Modal from '../../../Components/Modals/Nginx_Proxy_Manager_Account_Modal/Nginx_Proxy_Manager_Account_Modal';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';

const Nginx_Proxy_Manager_Accounts = () => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { connectedAccounts, fetchConnectedAccounts } = useConnectedAccounts('NGINX_PROXY_MANAGER');
  const [connecting, setConnecting] = useState(false);

  return (
    <Apps_Page title={t('apps.nginxProxyManager.title')} onAdd={() => setConnecting(true)} addLabel={t('apps.nginxProxyManager.connect')}>
      {connectedAccounts.length ? (
        connectedAccounts.map((account) => (
          <Apps_Account_Card
            key={account.id}
            avatar={account.displayName ?? 'NP'}
            title={account.displayName ?? t('apps.nginxProxyManager.title')}
            meta={account.appHost ?? ''}
            chips={
              account.appLatestVersion ? (
                <span className='Apps_chip update'>{t('apps.nginxProxyManager.updateChip', { version: account.appLatestVersion })}</span>
              ) : undefined
            }
            onOpen={() => navigate(`/MyHomeLab/Apps/NginxProxyManager/${account.id}`)}
          />
        ))
      ) : (
        <Apps_Empty_Card label={t('apps.nginxProxyManager.connect')} onAdd={() => setConnecting(true)} />
      )}
      <p className='Apps_section_note'>{t('apps.nginxProxyManager.agentsNote')}</p>

      {connecting && (
        <Nginx_Proxy_Manager_Account_Modal
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

export default Nginx_Proxy_Manager_Accounts;
