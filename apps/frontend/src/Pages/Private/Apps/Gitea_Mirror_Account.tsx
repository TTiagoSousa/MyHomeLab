import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import { useGiteaMirrorStatus } from '../../../Hooks/ConnectedAccount/useGiteaMirrorStatus';
import { Apps_Detail_Header } from './appsShared';
import App_Account from './App_Account';
import App_Location from './App_Location';
import App_Summary from './App_Summary';
import App_Settings_Menu from './App_Settings_Menu';
import App_Modal from './App_Modal';
import App_Linked_Cards, { type App_Linked_Panel } from './App_Linked_Cards';
import { appSettingsItems } from './appSettingsItems';
import Gitea_Mirror_Account_Modal from '../../../Components/Modals/Gitea_Mirror_Account_Modal/Gitea_Mirror_Account_Modal';
import Linked_Docs from '../../../Components/Linked_Docs/Linked_Docs';
import Agent_Access from '../../../Components/Agent_Access/Agent_Access';
import Update_Attempts from '../../../Components/Update_Attempts/Update_Attempts';
import Linked_Schedules from '../../../Components/Linked_Schedules/Linked_Schedules';
import * as Icon from '../../../Imports/icons';

type Gitea_Mirror_Panel = 'account' | App_Linked_Panel;

const PANEL_SECTIONS: Record<string, Gitea_Mirror_Panel> = {
  account: 'account',
  location: 'account',
  agents: 'agents',
  docs: 'docs',
  schedules: 'schedules',
};

const Gitea_Mirror_Account = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { connectedAccounts, loading, fetchConnectedAccounts } = useConnectedAccounts('GITEA_MIRROR');
  const { status, loading: checking, error, fetchStatus } = useGiteaMirrorStatus(accountId);
  const { deleteConnectedAccount, loading: removing } = useConnectedAccount();
  const [panel, setPanel] = useState<Gitea_Mirror_Panel | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [linkedVersion, setLinkedVersion] = useState(0);

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? t('apps.giteaMirror.title');
  const label = account?.displayName ? `Gitea Mirror · ${account.displayName}` : 'Gitea Mirror';
  const baseUrl = account?.appHost ? `https://${account.appHost}` : '';
  const state = !account?.isActive ? 'off' : error ? 'error' : checking && !status ? 'checking' : status ? 'ok' : 'unknown';

  const disconnect = async () => {
    if (account && (await deleteConnectedAccount(account.id))) navigate('/MyHomeLab/Apps/GiteaMirror');
  };

  const closePanel = () => {
    if (panel !== 'account') setLinkedVersion(linkedVersion + 1);
    setPanel(null);
  };

  const menuItems = appSettingsItems(['account', 'location', 'agents', 'docs', 'schedules'], t, t('apps.giteaMirror.credentialsHint')).map((item) =>
    PANEL_SECTIONS[item.id] ? { ...item, onSelect: () => setPanel(PANEL_SECTIONS[item.id]) } : item,
  );

  return (
    <div className='Apps'>
      <Apps_Detail_Header
        backTo='/MyHomeLab/Apps/GiteaMirror'
        backLabel={t('apps.giteaMirror.title')}
        title={name}
        actions={account && <App_Settings_Menu items={menuItems} />}
      />

      {!account ? (
        <p className='Apps_intro'>{loading ? t('apps.loading') : t('apps.giteaMirror.notFound')}</p>
      ) : (
        <div className='Apps_list'>
          <App_Summary
            icon={<Icon.GiteaMirror />}
            state={state}
            host={account.appHost}
            user={account.displayName}
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
                label: t('apps.giteaMirror.repositories'),
                value: status ? String(status.repositories) : checking ? t('apps.loading') : '—',
                hint: status
                  ? Object.entries(status.byStatus)
                      .map(([key, count]) => `${count} ${t(`apps.giteaMirror.statuses.${key}`, { defaultValue: key })}`)
                      .join(' · ') || undefined
                  : undefined,
              },
              {
                label: t('apps.giteaMirror.health'),
                value: status ? t(`apps.giteaMirror.healthStates.${status.health}`, { defaultValue: status.health }) : '—',
                hint: status ? t('apps.giteaMirror.failedCount', { count: status.failed.length }) : undefined,
              },
              {
                label: t('apps.giteaMirror.mcp'),
                value: status ? (status.mcp ? t('apps.giteaMirror.mcpOn', { count: status.mcp }) : t('apps.giteaMirror.mcpOff')) : '—',
                hint: t('apps.giteaMirror.mcpHint'),
              },
            ]}
          >
            {error && <p className='Apps_section_note error'>{error}</p>}
            {status?.failed.length ? (
              <ul className='Apps_section_note'>
                {status.failed.map((item) => (
                  <li key={item.name}>
                    {item.error ? t('apps.giteaMirror.failedItem', { name: item.name, error: item.error }) : item.name}
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
              icon={<Icon.GiteaMirror />}
              description={t('apps.giteaMirror.accountDescription')}
              type={t('apps.giteaMirror.title')}
              name={name}
              host={account.appHost}
              user={account.displayName ?? null}
              userLabel={t('apps.giteaMirror.profile')}
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
                  {t('apps.giteaMirror.replaceToken')}
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
        <Gitea_Mirror_Account_Modal
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

export default Gitea_Mirror_Account;
