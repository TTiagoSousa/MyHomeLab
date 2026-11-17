import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import { useImmichStatus } from '../../../Hooks/ConnectedAccount/useImmichStatus';
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
import Immich_Account_Modal from '../../../Components/Modals/Immich_Account_Modal/Immich_Account_Modal';
import Linked_Docs from '../../../Components/Linked_Docs/Linked_Docs';
import Agent_Access from '../../../Components/Agent_Access/Agent_Access';
import Update_Attempts from '../../../Components/Update_Attempts/Update_Attempts';
import Linked_Schedules from '../../../Components/Linked_Schedules/Linked_Schedules';
import * as Icon from '../../../Imports/icons';

type Immich_Panel = 'account' | App_Linked_Panel;

const PANEL_SECTIONS: Record<string, Immich_Panel> = {
  account: 'account',
  location: 'account',
  agents: 'agents',
  docs: 'docs',
  schedules: 'schedules',
};

const Immich_Account = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { connectedAccounts, loading, fetchConnectedAccounts } = useConnectedAccounts('IMMICH');
  const { status, loading: checking, error, fetchStatus } = useImmichStatus(accountId);
  const { deleteConnectedAccount, loading: removing } = useConnectedAccount();
  const [panel, setPanel] = useState<Immich_Panel | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [linkedVersion, setLinkedVersion] = useState(0);

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? t('apps.immich.title');
  const label = account?.displayName ? `Immich · ${account.displayName}` : 'Immich';
  const baseUrl = account?.appHost ? `https://${account.appHost}` : '';
  const state = !account?.isActive ? 'off' : error ? 'error' : checking && !status ? 'checking' : status ? 'ok' : 'unknown';

  const disconnect = async () => {
    if (account && (await deleteConnectedAccount(account.id))) navigate('/MyHomeLab/Apps/Immich');
  };

  const closePanel = () => {
    if (panel !== 'account') setLinkedVersion(linkedVersion + 1);
    setPanel(null);
  };

  const menuItems = appSettingsItems(['account', 'location', 'updates', 'backups', 'agents', 'docs', 'schedules'], t, t('apps.immich.credentialsHint')).map(
    (item) => (PANEL_SECTIONS[item.id] ? { ...item, onSelect: () => setPanel(PANEL_SECTIONS[item.id]) } : item),
  );

  return (
    <div className='Apps'>
      <Apps_Detail_Header
        backTo='/MyHomeLab/Apps/Immich'
        backLabel={t('apps.immich.title')}
        title={name}
        actions={
          account && (
            <>
              <button type='button' className='Apps_header_button compact' onClick={() => navigate(`/MyHomeLab/Apps/Immich/${accountId}/Connections`)}>
                {t('apps.immich.connections.title')}
              </button>
              <App_Settings_Menu items={menuItems} />
            </>
          )
        }
      />

      {!account ? (
        <p className='Apps_intro'>{loading ? t('apps.loading') : t('apps.immich.notFound')}</p>
      ) : (
        <div className='Apps_list'>
          <App_Summary
            icon={<Icon.Immich />}
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
                label: t('apps.immich.library'),
                value: status ? t('apps.immich.photosValue', { count: status.photos }) : checking ? t('apps.loading') : '—',
                hint: status ? t('apps.immich.videosValue', { count: status.videos }) : undefined,
              },
              {
                label: t('apps.immich.disk'),
                value: status ? `${status.diskPercent}%` : '—',
                hint: status ? t('apps.immich.diskHint', { used: status.diskUse, size: status.diskSize }) : undefined,
              },
              {
                label: t('apps.immich.key'),
                value: status ? t(status.isAdmin ? 'apps.immich.keyAdmin' : 'apps.immich.keyUser') : '—',
                hint: status?.failedJobs ? t('apps.immich.failedJobs', { count: status.failedJobs }) : t('apps.immich.keyHint'),
              },
            ]}
          >
            {error && <p className='Apps_section_note error'>{error}</p>}
            {status && !status.isAdmin && <p className='Apps_section_note'>{t('apps.immich.notAdmin')}</p>}
            {status?.pausedQueues?.length ? <p className='Apps_section_note'>{t('apps.immich.pausedQueues', { queues: status.pausedQueues.join(', ') })}</p> : null}
          </App_Summary>

          <App_Updates accountId={account.id} appName={t('apps.immich.title')} />

          <div id='app-backups'>
            <App_Backups
              accountId={account.id}
              serviceName={name}
              defaultFolder='Immich'
              fileExample='immich-2026-11-17_030000.sql.gz'
              textKey='addons:apps.immich.backup'
            />
          </div>

          <Update_Attempts accountId={account.id} label={label} />

          <App_Linked_Cards key={linkedVersion} type='APP' targetId={account.id} onOpen={setPanel} />
        </div>
      )}

      {account && panel && (
        <App_Modal onClose={closePanel}>
          {panel === 'account' && (
            <App_Account
              icon={<Icon.Immich />}
              description={t('apps.immich.accountDescription')}
              type={t('apps.immich.title')}
              name={name}
              host={account.appHost}
              user={status?.profile ?? null}
              userLabel={t('apps.immich.profile')}
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
                <button type='button' onClick={() => setReplacing(true)}>
                  {t('apps.immich.replaceKey')}
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
        <Immich_Account_Modal
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

export default Immich_Account;
