import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import { useOpenGymStatus } from '../../../Hooks/ConnectedAccount/useOpenGymStatus';
import { Apps_Detail_Header } from './appsShared';
import App_Account from './App_Account';
import App_Location from './App_Location';
import App_Summary from './App_Summary';
import App_Updates from './App_Updates';
import App_Settings_Menu from './App_Settings_Menu';
import App_Modal from './App_Modal';
import App_Linked_Cards, { type App_Linked_Panel } from './App_Linked_Cards';
import { appSettingsItems } from './appSettingsItems';
import OpenGym_Account_Modal from '../../../Components/Modals/OpenGym_Account_Modal/OpenGym_Account_Modal';
import OpenGym_Mcp_Modal from '../../../Components/Modals/OpenGym_Mcp_Modal/OpenGym_Mcp_Modal';
import Linked_Docs from '../../../Components/Linked_Docs/Linked_Docs';
import Agent_Access from '../../../Components/Agent_Access/Agent_Access';
import Update_Attempts from '../../../Components/Update_Attempts/Update_Attempts';
import Linked_Schedules from '../../../Components/Linked_Schedules/Linked_Schedules';
import { dateLocale } from '../../../i18n';
import * as Icon from '../../../Imports/icons';

type OpenGym_Panel = 'account' | App_Linked_Panel;

const PANEL_SECTIONS: Record<string, OpenGym_Panel> = {
  account: 'account',
  location: 'account',
  agents: 'agents',
  docs: 'docs',
  schedules: 'schedules',
};

const dayOf = (value: string | null | undefined) => (value ? new Date(value).toLocaleDateString(dateLocale()) : null);

const OpenGym_Account = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { connectedAccounts, loading, error: accountsError, fetchConnectedAccounts } = useConnectedAccounts('OPENGYM');
  const { status, loading: checking, error, fetchStatus } = useOpenGymStatus(accountId);
  const { deleteConnectedAccount, loading: removing } = useConnectedAccount();
  const [panel, setPanel] = useState<OpenGym_Panel | null>(null);
  const [pairing, setPairing] = useState(false);
  const [editingMcp, setEditingMcp] = useState(false);
  const [linkedVersion, setLinkedVersion] = useState(0);

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? t('apps.openGym.title');
  const label = account?.displayName ? `openGym · ${account.displayName}` : 'openGym';
  const baseUrl = account?.appBaseUrl ?? '';
  const state = !account?.isActive ? 'off' : error ? 'error' : checking && !status ? 'checking' : status ? 'ok' : 'unknown';
  const expires = dayOf(status?.tokenExpiresAt ?? account?.tokenExpiresAt);
  const mcp = status?.mcp;
  const mcpValue = !mcp ? '—' : !mcp.configured ? t('apps.openGym.mcp.off') : mcp.error ? t('apps.openGym.mcp.failing') : t('apps.openGym.mcp.on', { count: mcp.tools });

  const disconnect = async () => {
    if (account && (await deleteConnectedAccount(account.id))) navigate('/MyHomeLab/Apps/OpenGym');
  };

  const closePanel = () => {
    if (panel !== 'account') setLinkedVersion(linkedVersion + 1);
    setPanel(null);
  };

  const menuItems = [
    ...appSettingsItems(['account', 'location'], t, t('apps.openGym.credentialsHint')),
    {
      id: 'mcp',
      icon: Icon.Agents,
      name: t('apps.openGym.mcp.title'),
      hint: mcp?.configured ? t('apps.openGym.mcp.menuOn') : t('apps.openGym.mcp.menuOff'),
      onSelect: () => setEditingMcp(true),
    },
    ...appSettingsItems(['updates', 'agents', 'docs', 'schedules'], t),
  ].map((item) => (PANEL_SECTIONS[item.id] ? { ...item, onSelect: () => setPanel(PANEL_SECTIONS[item.id]) } : item));

  return (
    <div className='Apps'>
      <Apps_Detail_Header
        backTo='/MyHomeLab/Apps/OpenGym'
        backLabel={t('apps.openGym.title')}
        title={name}
        actions={
          account && (
            <>
              <button type='button' className='Apps_header_button compact' onClick={() => navigate(`/MyHomeLab/Apps/OpenGym/${accountId}/Connections`)}>
                {t('apps.openGym.connections.title')}
              </button>
              <App_Settings_Menu items={menuItems} />
            </>
          )
        }
      />

      {!account ? (
        <p className='Apps_intro'>{accountsError || (loading ? t('apps.loading') : t('apps.openGym.notFound'))}</p>
      ) : (
        <div className='Apps_list'>
          <App_Summary
            icon={<Icon.OpenGym />}
            state={state}
            host={account.appHost}
            user={status?.profile ?? account.displayName}
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
                label: t('apps.openGym.training'),
                value: status ? t('apps.openGym.trainingValue', { routines: status.routines, workouts: status.workouts }) : checking ? t('apps.loading') : '—',
                hint: status?.lastWorkout ? t('apps.openGym.lastWorkout', { day: dayOf(status.lastWorkout) }) : undefined,
              },
              {
                label: t('apps.openGym.week'),
                value: status ? t('apps.openGym.weekValue', { count: status.plannedDays }) : '—',
              },
              {
                label: t('apps.openGym.token'),
                value: expires ? t('apps.openGym.tokenUntil', { day: expires }) : '—',
                hint: t('apps.openGym.tokenHint'),
              },
              {
                label: t('apps.openGym.mcp.fact'),
                value: mcpValue,
                hint: mcp?.error ?? t('apps.openGym.mcp.factHint'),
              },
            ]}
          >
            {error && <p className='Apps_section_note error'>{error}</p>}
            {status && !status.writable && <p className='Apps_section_note error'>{t('apps.openGym.notWritable')}</p>}
            {mcp?.error && <p className='Apps_section_note error'>{mcp.error}</p>}
          </App_Summary>

          <App_Updates accountId={account.id} appName={t('apps.openGym.title')} />

          <Update_Attempts accountId={account.id} label={label} />

          <App_Linked_Cards key={linkedVersion} type='APP' targetId={account.id} onOpen={setPanel} />
        </div>
      )}

      {account && panel && (
        <App_Modal onClose={closePanel}>
          {panel === 'account' && (
            <App_Account
              icon={<Icon.OpenGym />}
              description={t('apps.openGym.accountDescription')}
              type={t('apps.openGym.title')}
              name={name}
              host={account.appHost}
              user={status?.profile ?? null}
              userLabel={t('apps.openGym.profile')}
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
                <>
                  <button type='button' onClick={() => setPairing(true)}>
                    {t('apps.openGym.pairAgain')}
                  </button>
                  <button type='button' onClick={() => setEditingMcp(true)}>
                    {t('apps.openGym.mcp.title')}
                  </button>
                </>
              }
              details={
                expires && (
                  <>
                    <dt>{t('apps.openGym.token')}</dt>
                    <dd>{t('apps.openGym.tokenUntil', { day: expires })}</dd>
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
        <OpenGym_Mcp_Modal
          accountId={account.id}
          configured={Boolean(mcp?.configured)}
          onClose={() => setEditingMcp(false)}
          onSaved={() => {
            setEditingMcp(false);
            void fetchStatus();
          }}
        />
      )}

      {pairing && (
        <OpenGym_Account_Modal
          initialUrl={baseUrl}
          onClose={() => setPairing(false)}
          onSaved={() => {
            setPairing(false);
            fetchConnectedAccounts();
            void fetchStatus();
          }}
        />
      )}
    </div>
  );
};

export default OpenGym_Account;
