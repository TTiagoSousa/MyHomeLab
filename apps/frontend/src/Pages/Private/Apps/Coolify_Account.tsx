import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import { useCoolifyStatus } from '../../../Hooks/ConnectedAccount/useCoolifyStatus';
import { Apps_Detail_Header } from './appsShared';
import App_Account from './App_Account';
import App_Location from './App_Location';
import App_Summary from './App_Summary';
import App_Settings_Menu from './App_Settings_Menu';
import App_Cron_Button from './App_Cron_Button';
import App_Modal from './App_Modal';
import App_Linked_Cards, { type App_Linked_Panel } from './App_Linked_Cards';
import { appSettingsItems } from './appSettingsItems';
import Coolify_Account_Modal from '../../../Components/Modals/Coolify_Account_Modal/Coolify_Account_Modal';
import Linked_Docs from '../../../Components/Linked_Docs/Linked_Docs';
import Agent_Access from '../../../Components/Agent_Access/Agent_Access';
import Update_Attempts from '../../../Components/Update_Attempts/Update_Attempts';
import Linked_Schedules from '../../../Components/Linked_Schedules/Linked_Schedules';
import * as Icon from '../../../Imports/icons';

type Coolify_Panel = 'account' | App_Linked_Panel;

const PANEL_SECTIONS: Record<string, Coolify_Panel> = {
  account: 'account',
  location: 'account',
  agents: 'agents',
  docs: 'docs',
  schedules: 'schedules',
};

const Coolify_Account = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { connectedAccounts, loading, error: accountsError, fetchConnectedAccounts } = useConnectedAccounts('COOLIFY');
  const { status, loading: checking, error, fetchStatus } = useCoolifyStatus(accountId);
  const { deleteConnectedAccount, loading: removing } = useConnectedAccount();
  const [panel, setPanel] = useState<Coolify_Panel | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [linkedVersion, setLinkedVersion] = useState(0);

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? t('apps.coolify.title');
  const label = account?.displayName ? `Coolify · ${account.displayName}` : 'Coolify';
  const baseUrl = account?.appBaseUrl ?? '';
  const state = !account?.isActive ? 'off' : error ? 'error' : checking && !status ? 'checking' : status ? 'ok' : 'unknown';

  const disconnect = async () => {
    if (account && (await deleteConnectedAccount(account.id))) navigate('/MyHomeLab/Apps/Coolify');
  };

  const closePanel = () => {
    if (panel !== 'account') setLinkedVersion(linkedVersion + 1);
    setPanel(null);
  };

  const menuItems = appSettingsItems(['account', 'location', 'agents', 'docs', 'schedules'], t, t('apps.coolify.credentialsHint')).map((item) =>
    PANEL_SECTIONS[item.id] ? { ...item, onSelect: () => setPanel(PANEL_SECTIONS[item.id]) } : item,
  );

  return (
    <div className='Apps'>
      <Apps_Detail_Header
        backTo='/MyHomeLab/Apps/Coolify'
        backLabel={t('apps.coolify.title')}
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
        <p className='Apps_intro'>{accountsError || (loading ? t('apps.loading') : t('apps.coolify.notFound'))}</p>
      ) : (
        <div className='Apps_list'>
          <App_Summary
            icon={<Icon.Coolify />}
            state={state}
            host={account.appHost}
            user={status?.team ?? account.displayName}
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
                label: t('apps.coolify.servers'),
                value: status ? String(status.servers) : checking ? t('apps.loading') : '—',
                hint: status
                  ? status.unreachable.length
                    ? t('apps.coolify.unreachable', { names: status.unreachable.join(', ') })
                    : t('apps.coolify.allReachable')
                  : undefined,
              },
              {
                label: t('apps.coolify.resources'),
                value: status ? String(status.resources.applications + status.resources.services + status.resources.databases) : '—',
                hint: status
                  ? t('apps.coolify.resourcesHint', {
                      applications: status.resources.applications,
                      services: status.resources.services,
                      databases: status.resources.databases,
                      projects: status.projects,
                    })
                  : undefined,
              },
              {
                label: t('apps.coolify.mcp'),
                value: status ? (status.mcp ? t('apps.coolify.mcpOn', { count: status.mcp }) : t('apps.coolify.mcpOff')) : '—',
                hint: t('apps.coolify.mcpHint'),
              },
            ]}
          >
            {error && <p className='Apps_section_note error'>{error}</p>}
            {status?.unhealthy.length ? (
              <ul className='Apps_section_note'>
                {status.unhealthy.map((item) => (
                  <li key={item.name}>{t('apps.coolify.unhealthyItem', { name: item.name, status: item.status })}</li>
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
              icon={<Icon.Coolify />}
              description={t('apps.coolify.accountDescription')}
              type={t('apps.coolify.title')}
              name={name}
              host={account.appHost}
              user={status?.team ?? null}
              userLabel={t('apps.coolify.profile')}
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
              actions={
                <button type='button' onClick={() => setReplacing(true)}>
                  {t('apps.coolify.replaceToken')}
                </button>
              }
              location={<App_Location account={account} onSaved={fetchConnectedAccounts} />}
            />
          )}
          {panel === 'agents' && <Agent_Access type='APP' targetId={account.id} label={label} />}
          {panel === 'docs' && <Linked_Docs type='APP' targetId={account.id} label={label} />}
          {panel === 'schedules' && <Linked_Schedules type='APP' targetId={account.id} label={label} />}
        </App_Modal>
      )}

      {replacing && (
        <Coolify_Account_Modal
          initialUrl={baseUrl}
          onClose={() => setReplacing(false)}
          onSaved={() => {
            setReplacing(false);
            fetchConnectedAccounts();
            void fetchStatus();
          }}
        />
      )}
    </div>
  );
};

export default Coolify_Account;
