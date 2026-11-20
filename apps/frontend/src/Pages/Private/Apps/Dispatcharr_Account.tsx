import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import { useDispatcharrStatus } from '../../../Hooks/ConnectedAccount/useDispatcharrStatus';
import { Apps_Detail_Header } from './appsShared';
import App_Account from './App_Account';
import App_Location from './App_Location';
import App_Summary from './App_Summary';
import App_Settings_Menu from './App_Settings_Menu';
import App_Modal from './App_Modal';
import App_Linked_Cards, { type App_Linked_Panel } from './App_Linked_Cards';
import { appSettingsItems } from './appSettingsItems';
import Dispatcharr_Account_Modal from '../../../Components/Modals/Dispatcharr_Account_Modal/Dispatcharr_Account_Modal';
import Linked_Docs from '../../../Components/Linked_Docs/Linked_Docs';
import Agent_Access from '../../../Components/Agent_Access/Agent_Access';
import Update_Attempts from '../../../Components/Update_Attempts/Update_Attempts';
import Linked_Schedules from '../../../Components/Linked_Schedules/Linked_Schedules';
import * as Icon from '../../../Imports/icons';

type Dispatcharr_Panel = 'account' | App_Linked_Panel;

const PANEL_SECTIONS: Record<string, Dispatcharr_Panel> = {
  account: 'account',
  location: 'account',
  agents: 'agents',
  docs: 'docs',
  schedules: 'schedules',
};

const Dispatcharr_Account = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { connectedAccounts, loading, fetchConnectedAccounts } = useConnectedAccounts('DISPATCHARR');
  const { status, loading: checking, error, fetchStatus } = useDispatcharrStatus(accountId);
  const { deleteConnectedAccount, loading: removing } = useConnectedAccount();
  const [panel, setPanel] = useState<Dispatcharr_Panel | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [linkedVersion, setLinkedVersion] = useState(0);

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? t('apps.dispatcharr.title');
  const label = account?.displayName ? `Dispatcharr · ${account.displayName}` : 'Dispatcharr';
  const baseUrl = account?.appHost ? `https://${account.appHost}` : '';
  const state = !account?.isActive ? 'off' : error ? 'error' : checking && !status ? 'checking' : status ? 'ok' : 'unknown';

  const sourceProblems = status
    ? [...status.m3uAccounts, ...status.epgSources].filter((source) => source.active && source.status === 'error').map((source) => source.name)
    : [];

  const disconnect = async () => {
    if (account && (await deleteConnectedAccount(account.id))) navigate('/MyHomeLab/Apps/Dispatcharr');
  };

  const closePanel = () => {
    if (panel !== 'account') setLinkedVersion(linkedVersion + 1);
    setPanel(null);
  };

  const menuItems = appSettingsItems(['account', 'location', 'agents', 'docs', 'schedules'], t, t('apps.dispatcharr.credentialsHint')).map((item) =>
    PANEL_SECTIONS[item.id] ? { ...item, onSelect: () => setPanel(PANEL_SECTIONS[item.id]) } : item,
  );

  return (
    <div className='Apps'>
      <Apps_Detail_Header
        backTo='/MyHomeLab/Apps/Dispatcharr'
        backLabel={t('apps.dispatcharr.title')}
        title={name}
        actions={account && <App_Settings_Menu items={menuItems} />}
      />

      {!account ? (
        <p className='Apps_intro'>{loading ? t('apps.loading') : t('apps.dispatcharr.notFound')}</p>
      ) : (
        <div className='Apps_list'>
          <App_Summary
            icon={<Icon.Dispatcharr />}
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
                label: t('apps.dispatcharr.channels'),
                value: status ? String(status.channels) : checking ? t('apps.loading') : '—',
                hint: status ? t('apps.dispatcharr.streamsHint', { count: status.streams }) : undefined,
              },
              {
                label: t('apps.dispatcharr.sources'),
                value: status ? t('apps.dispatcharr.sourcesValue', { m3u: status.m3uAccounts.length, epg: status.epgSources.length }) : '—',
                hint: sourceProblems.length ? t('apps.dispatcharr.sourcesProblems', { names: sourceProblems.join(' · ') }) : undefined,
              },
              {
                label: t('apps.dispatcharr.live'),
                value: status ? String(status.liveChannels) : '—',
                hint: status ? t('apps.dispatcharr.clientsHint', { count: status.clients }) : undefined,
              },
            ]}
          >
            {error && <p className='Apps_section_note error'>{error}</p>}
          </App_Summary>

          <Update_Attempts accountId={account.id} label={label} />

          <App_Linked_Cards key={linkedVersion} type='APP' targetId={account.id} onOpen={setPanel} />
        </div>
      )}

      {account && panel && (
        <App_Modal onClose={closePanel}>
          {panel === 'account' && (
            <App_Account
              icon={<Icon.Dispatcharr />}
              description={t('apps.dispatcharr.accountDescription')}
              type={t('apps.dispatcharr.title')}
              name={name}
              host={account.appHost}
              user={status?.profile ?? null}
              userLabel={t('apps.dispatcharr.profile')}
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
                  {t('apps.dispatcharr.replaceKey')}
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
        <Dispatcharr_Account_Modal
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

export default Dispatcharr_Account;
