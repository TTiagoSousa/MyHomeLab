import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import { useTrekStatus } from '../../../Hooks/ConnectedAccount/useTrekStatus';
import { Apps_Detail_Header } from './appsShared';
import App_Account from './App_Account';
import App_Location from './App_Location';
import App_Summary from './App_Summary';
import App_Updates from './App_Updates';
import App_Settings_Menu from './App_Settings_Menu';
import App_Backups from './App_Backups';
import App_Modal from './App_Modal';
import App_Linked_Cards, { type App_Linked_Panel } from './App_Linked_Cards';
import { appSettingsItems } from './appSettingsItems';
import Trek_Mcp_Modal from '../../../Components/Modals/Trek_Mcp_Modal/Trek_Mcp_Modal';
import Linked_Docs from '../../../Components/Linked_Docs/Linked_Docs';
import Agent_Access from '../../../Components/Agent_Access/Agent_Access';
import Update_Attempts from '../../../Components/Update_Attempts/Update_Attempts';
import Linked_Schedules from '../../../Components/Linked_Schedules/Linked_Schedules';
import * as Icon from '../../../Imports/icons';

const LOGIN_METHODS = ['password', 'oidc', 'passkey'] as const;

type Trek_Panel = 'account' | App_Linked_Panel;

const PANEL_SECTIONS: Record<string, Trek_Panel> = {
  account: 'account',
  location: 'account',
  agents: 'agents',
  docs: 'docs',
  schedules: 'schedules',
};

const Trek_Account = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { connectedAccounts, loading, fetchConnectedAccounts } = useConnectedAccounts('TREK');
  const { status, loading: checking, error, fetchStatus } = useTrekStatus(accountId);
  const { deleteConnectedAccount, loading: removing } = useConnectedAccount();
  const [panel, setPanel] = useState<Trek_Panel | null>(null);
  const [editingMcp, setEditingMcp] = useState(false);
  const [linkedVersion, setLinkedVersion] = useState(0);

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? account?.appHost ?? 'TREK';
  const label = account?.displayName ? `TREK · ${account.displayName}` : 'TREK';
  const loginMethods = status ? LOGIN_METHODS.filter((method) => status.login[method]).map((method) => t(`apps.trek.logins.${method}`)) : [];
  const state = !account?.isActive ? 'off' : error ? 'error' : checking && !status ? 'checking' : status ? 'ok' : 'unknown';
  const mcp = status?.mcp;
  const mcpValue = !mcp ? '—' : !mcp.configured ? t('apps.trek.mcp.off') : mcp.error ? t('apps.trek.mcp.failing') : t('apps.trek.mcp.on', { count: mcp.tools });

  const disconnect = async () => {
    if (account && (await deleteConnectedAccount(account.id))) navigate('/MyHomeLab/Apps/Trek');
  };

  const closePanel = () => {
    if (panel !== 'account') setLinkedVersion(linkedVersion + 1);
    setPanel(null);
  };

  const menuItems = [
    ...appSettingsItems(['account', 'location'], t, t('apps.trek.credentialsHint')),
    {
      id: 'mcp',
      icon: Icon.Agents,
      name: t('apps.trek.mcp.title'),
      hint: mcp?.configured ? t('apps.trek.mcp.menuOn') : t('apps.trek.mcp.menuOff'),
      onSelect: () => setEditingMcp(true),
    },
    ...appSettingsItems(['updates', 'backups', 'agents', 'docs', 'schedules'], t),
  ].map((item) => (PANEL_SECTIONS[item.id] ? { ...item, onSelect: () => setPanel(PANEL_SECTIONS[item.id]) } : item));

  return (
    <div className='Apps'>
      <Apps_Detail_Header
        backTo='/MyHomeLab/Apps/Trek'
        backLabel={t('apps.trek.title')}
        title={name}
        actions={
          account && (
            <>
              <button type='button' className='Apps_header_button compact' onClick={() => navigate(`/MyHomeLab/Apps/Trek/${accountId}/Connections`)}>
                {t('apps.trek.connections.title')}
              </button>
              <App_Settings_Menu items={menuItems} />
            </>
          )
        }
      />

      {!account ? (
        <p className='Apps_intro'>{loading ? t('apps.loading') : t('apps.trek.notFound')}</p>
      ) : (
        <div className='Apps_list'>
          <App_Summary
            icon={<Icon.Trek />}
            state={state}
            host={account.appHost}
            user={account.username}
            since={account.createdAt}
            checkedAt={account.appCheckedAt ?? null}
            version={status?.version ?? account.appVersion ?? null}
            latestVersion={status?.latestVersion ?? account.appLatestVersion}
            latestUrl={status?.latestUrl ?? account.appLatestUrl}
            checking={checking}
            onCheck={() => void fetchStatus()}
            onOpenAccount={() => setPanel('account')}
            facts={[
              {
                label: t('apps.trek.mcp.fact'),
                value: mcpValue,
                hint: mcp?.error ?? t('apps.trek.mcp.factHint'),
              },
              {
                label: t('apps.trek.registration'),
                value: status ? (status.registrationOpen ? t('apps.trek.registrationOpen') : t('apps.trek.registrationClosed')) : '—',
                hint: status?.registrationOpen ? t('apps.trek.registrationHint') : undefined,
              },
              {
                label: t('apps.trek.trekBackups'),
                value: status ? String(status.trekBackups) : '—',
              },
            ]}
          >
            {status && !mcp?.configured && (
              <p className='Apps_section_note'>
                {t('apps.trek.mcp.missing')}{' '}
                <button type='button' className='Apps_header_button compact' onClick={() => setEditingMcp(true)}>
                  {t('apps.trek.mcp.connect')}
                </button>
              </p>
            )}
            {mcp?.error && <p className='Apps_section_note error'>{mcp.error}</p>}
            {status?.registrationOpen && <p className='Apps_section_note update'>{t('apps.trek.registrationHint')}</p>}
            {error && <p className='Apps_section_note error'>{error}</p>}
          </App_Summary>

          <App_Updates accountId={account.id} appName={t('apps.trek.title')} />

          <div id='app-backups'>
            <App_Backups accountId={account.id} serviceName={name} defaultFolder='TREK' fileExample='trek-2026-10-30_030000.zip' textKey='addons:apps.trek.backup' />
          </div>

          <Update_Attempts accountId={account.id} label={label} />

          <App_Linked_Cards key={linkedVersion} type='APP' targetId={account.id} onOpen={setPanel} />
        </div>
      )}

      {account && panel && (
        <App_Modal onClose={closePanel}>
          {panel === 'account' && (
            <App_Account
              icon={<Icon.Trek />}
              description={t('apps.trek.accountDescription')}
              type={t('apps.trek.title')}
              name={name}
              host={account.appHost}
              user={account.username}
              userLabel={t('apps.trek.admin')}
              version={status?.version ?? account.appVersion ?? null}
              latestVersion={status?.latestVersion ?? account.appLatestVersion}
              latestUrl={status?.latestUrl ?? account.appLatestUrl}
              state={state}
              since={account.createdAt}
              checkedAt={account.appCheckedAt ?? null}
              checking={checking}
              onCheck={() => void fetchStatus()}
              removing={removing}
              onDisconnect={disconnect}
              actions={
                <button type='button' onClick={() => setEditingMcp(true)}>
                  {t('apps.trek.mcp.title')}
                </button>
              }
              details={
                status && (
                  <>
                    <dt>{t('apps.trek.mcp.fact')}</dt>
                    <dd>{mcpValue}</dd>
                    <dt>{t('apps.trek.loginMethods')}</dt>
                    <dd>{loginMethods.length ? loginMethods.join(', ') : '—'}</dd>
                    <dt>{t('apps.trek.mfa')}</dt>
                    <dd>{status.requireMfa ? t('apps.trek.mfaRequired') : t('apps.trek.mfaOptional')}</dd>
                  </>
                )
              }
              location={<App_Location account={account} onSaved={fetchConnectedAccounts} />}
            />
          )}
          {panel === 'agents' && <Agent_Access type='APP' targetId={account.id} label={label} />}
          {panel === 'docs' && <Linked_Docs type='APP' targetId={account.id} label={label} />}
          {panel === 'schedules' && <Linked_Schedules type='APP' targetId={account.id} label={label} />}
        </App_Modal>
      )}

      {account && editingMcp && (
        <Trek_Mcp_Modal
          accountId={account.id}
          configured={Boolean(mcp?.configured)}
          onClose={() => setEditingMcp(false)}
          onSaved={() => {
            setEditingMcp(false);
            void fetchStatus();
          }}
        />
      )}
    </div>
  );
};

export default Trek_Account;
