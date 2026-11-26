import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import { useNginxProxyManagerStatus } from '../../../Hooks/ConnectedAccount/useNginxProxyManagerStatus';
import { Apps_Detail_Header } from './appsShared';
import App_Account from './App_Account';
import App_Location from './App_Location';
import App_Summary from './App_Summary';
import App_Settings_Menu from './App_Settings_Menu';
import App_Cron_Button from './App_Cron_Button';
import App_Modal from './App_Modal';
import App_Linked_Cards, { type App_Linked_Panel } from './App_Linked_Cards';
import { appSettingsItems } from './appSettingsItems';
import Linked_Docs from '../../../Components/Linked_Docs/Linked_Docs';
import Agent_Access from '../../../Components/Agent_Access/Agent_Access';
import Update_Attempts from '../../../Components/Update_Attempts/Update_Attempts';
import Linked_Schedules from '../../../Components/Linked_Schedules/Linked_Schedules';
import { dateLocale } from '../../../i18n';
import * as Icon from '../../../Imports/icons';

type Nginx_Proxy_Manager_Panel = 'account' | App_Linked_Panel;

const PANEL_SECTIONS: Record<string, Nginx_Proxy_Manager_Panel> = {
  account: 'account',
  location: 'account',
  agents: 'agents',
  docs: 'docs',
  schedules: 'schedules',
};

const Nginx_Proxy_Manager_Account = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { connectedAccounts, loading, error: accountsError, fetchConnectedAccounts } = useConnectedAccounts('NGINX_PROXY_MANAGER');
  const { status, loading: checking, error, fetchStatus } = useNginxProxyManagerStatus(accountId);
  const { deleteConnectedAccount, loading: removing } = useConnectedAccount();
  const [panel, setPanel] = useState<Nginx_Proxy_Manager_Panel | null>(null);
  const [linkedVersion, setLinkedVersion] = useState(0);

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? t('apps.nginxProxyManager.title');
  const label = account?.displayName ? `Nginx Proxy Manager · ${account.displayName}` : 'Nginx Proxy Manager';
  const state = !account?.isActive ? 'off' : error ? 'error' : checking && !status ? 'checking' : status ? 'ok' : 'unknown';

  const disconnect = async () => {
    if (account && (await deleteConnectedAccount(account.id))) navigate('/MyHomeLab/Apps/NginxProxyManager');
  };

  const closePanel = () => {
    if (panel !== 'account') setLinkedVersion(linkedVersion + 1);
    setPanel(null);
  };

  const menuItems = appSettingsItems(['account', 'location', 'agents', 'docs', 'schedules'], t, t('apps.nginxProxyManager.credentialsHint')).map(
    (item) => (PANEL_SECTIONS[item.id] ? { ...item, onSelect: () => setPanel(PANEL_SECTIONS[item.id]) } : item),
  );

  return (
    <div className='Apps'>
      <Apps_Detail_Header
        backTo='/MyHomeLab/Apps/NginxProxyManager'
        backLabel={t('apps.nginxProxyManager.title')}
        title={name}
        actions={
          account && (
            <>
              <App_Cron_Button />
              <App_Settings_Menu items={menuItems} />
            </>
          )
        }
      />

      {!account ? (
        <p className='Apps_intro'>{accountsError || (loading ? t('apps.loading') : t('apps.nginxProxyManager.notFound'))}</p>
      ) : (
        <div className='Apps_list'>
          <App_Summary
            icon={<Icon.NginxProxyManager />}
            state={state}
            host={account.appHost}
            user={status?.profile ?? account.displayName}
            since={account.createdAt}
            checkedAt={account.appCheckedAt ?? null}
            version={status?.version ?? account.appVersion ?? null}
            latestVersion={account.appLatestVersion}
            latestUrl={account.appLatestUrl}
            checking={checking}
            onCheck={() => void fetchStatus()}
            onOpenAccount={() => setPanel('account')}
            facts={[
              {
                label: t('apps.nginxProxyManager.proxyHosts'),
                value: status ? String(status.proxyHosts) : checking ? t('apps.loading') : '—',
                hint: status
                  ? t('apps.nginxProxyManager.hostsHint', {
                      redirections: status.redirectionHosts,
                      dead: status.deadHosts,
                      streams: status.streams,
                    })
                  : undefined,
              },
              {
                label: t('apps.nginxProxyManager.health'),
                value: status ? (status.offline ? t('apps.nginxProxyManager.offline', { count: status.offline }) : t('apps.nginxProxyManager.allOnline')) : '—',
                hint: status ? t('apps.nginxProxyManager.disabled', { count: status.disabled }) : undefined,
              },
              {
                label: t('apps.nginxProxyManager.certificates'),
                value: status ? String(status.certificates) : '—',
                hint: status
                  ? status.expiringSoon.length
                    ? t('apps.nginxProxyManager.expiring', { count: status.expiringSoon.length })
                    : t('apps.nginxProxyManager.noneExpiring')
                  : undefined,
              },
            ]}
          >
            {error && <p className='Apps_section_note error'>{error}</p>}
            {status?.expiringSoon.length ? (
              <ul className='Apps_section_note'>
                {status.expiringSoon.map((item) => (
                  <li key={item.name}>
                    {item.days < 0
                      ? t('apps.nginxProxyManager.expiredItem', { name: item.name })
                      : t('apps.nginxProxyManager.expiringItem', {
                          name: item.name,
                          date: item.expiresOn ? new Date(item.expiresOn.replace(' ', 'T')).toLocaleDateString(dateLocale()) : '—',
                          count: item.days,
                        })}
                  </li>
                ))}
              </ul>
            ) : null}
          </App_Summary>

          <Update_Attempts accountId={account.id} label={label} />

          <App_Linked_Cards key={linkedVersion} type='APP' targetId={account.id} onOpen={setPanel} />
        </div>
      )}

      {account && panel && (
        <App_Modal onClose={closePanel}>
          {panel === 'account' && (
            <App_Account
              icon={<Icon.NginxProxyManager />}
              description={t('apps.nginxProxyManager.accountDescription')}
              type={t('apps.nginxProxyManager.title')}
              name={name}
              host={account.appHost}
              user={status?.profile ?? null}
              userLabel={t('apps.nginxProxyManager.profile')}
              version={status?.version ?? account.appVersion ?? null}
              latestVersion={account.appLatestVersion}
              latestUrl={account.appLatestUrl}
              state={state}
              since={account.createdAt}
              checkedAt={account.appCheckedAt ?? null}
              checking={checking}
              onCheck={() => void fetchStatus()}
              removing={removing}
              onDisconnect={disconnect}
              location={<App_Location account={account} onSaved={fetchConnectedAccounts} />}
            />
          )}
          {panel === 'agents' && <Agent_Access type='APP' targetId={account.id} label={label} />}
          {panel === 'docs' && <Linked_Docs type='APP' targetId={account.id} label={label} />}
          {panel === 'schedules' && <Linked_Schedules type='APP' targetId={account.id} label={label} />}
        </App_Modal>
      )}
    </div>
  );
};

export default Nginx_Proxy_Manager_Account;
