import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import { usePaperlessStatus } from '../../../Hooks/ConnectedAccount/usePaperlessStatus';
import { Apps_Detail_Header } from './appsShared';
import App_Account from './App_Account';
import App_Location from './App_Location';
import App_Summary from './App_Summary';
import App_Updates from './App_Updates';
import App_Settings_Menu from './App_Settings_Menu';
import App_Modal from './App_Modal';
import App_Linked_Cards, { type App_Linked_Panel } from './App_Linked_Cards';
import { appSettingsItems } from './appSettingsItems';
import Paperless_Account_Modal from '../../../Components/Modals/Paperless_Account_Modal/Paperless_Account_Modal';
import Linked_Docs from '../../../Components/Linked_Docs/Linked_Docs';
import Agent_Access from '../../../Components/Agent_Access/Agent_Access';
import Update_Attempts from '../../../Components/Update_Attempts/Update_Attempts';
import Linked_Schedules from '../../../Components/Linked_Schedules/Linked_Schedules';
import * as Icon from '../../../Imports/icons';

type Paperless_Panel = 'account' | App_Linked_Panel;

const PANEL_SECTIONS: Record<string, Paperless_Panel> = {
  account: 'account',
  location: 'account',
  agents: 'agents',
  docs: 'docs',
  schedules: 'schedules',
};

const Paperless_Account = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { connectedAccounts, loading, fetchConnectedAccounts } = useConnectedAccounts('PAPERLESS');
  const { status, loading: checking, error, fetchStatus } = usePaperlessStatus(accountId);
  const { deleteConnectedAccount, loading: removing } = useConnectedAccount();
  const [panel, setPanel] = useState<Paperless_Panel | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [linkedVersion, setLinkedVersion] = useState(0);

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? t('apps.paperless.title');
  const label = account?.displayName ? `Paperless · ${account.displayName}` : 'Paperless';
  const baseUrl = account?.appHost ? `https://${account.appHost}` : '';
  const state = !account?.isActive ? 'off' : error ? 'error' : checking && !status ? 'checking' : status ? 'ok' : 'unknown';

  const disconnect = async () => {
    if (account && (await deleteConnectedAccount(account.id))) navigate('/MyHomeLab/Apps/Paperless');
  };

  const closePanel = () => {
    if (panel !== 'account') setLinkedVersion(linkedVersion + 1);
    setPanel(null);
  };

  const menuItems = appSettingsItems(['account', 'location', 'updates', 'agents', 'docs', 'schedules'], t, t('apps.paperless.credentialsHint')).map(
    (item) => (PANEL_SECTIONS[item.id] ? { ...item, onSelect: () => setPanel(PANEL_SECTIONS[item.id]) } : item),
  );

  return (
    <div className='Apps'>
      <Apps_Detail_Header
        backTo='/MyHomeLab/Apps/Paperless'
        backLabel={t('apps.paperless.title')}
        title={name}
        actions={
          account && (
            <>
              <button type='button' className='Apps_header_button compact' onClick={() => navigate(`/MyHomeLab/Apps/Paperless/${accountId}/Connections`)}>
                {t('apps.paperless.connections.title')}
              </button>
              <App_Settings_Menu items={menuItems} />
            </>
          )
        }
      />

      {!account ? (
        <p className='Apps_intro'>{loading ? t('apps.loading') : t('apps.paperless.notFound')}</p>
      ) : (
        <div className='Apps_list'>
          <App_Summary
            icon={<Icon.Paperless />}
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
                label: t('apps.paperless.library'),
                value: status ? t('apps.paperless.documentsValue', { count: status.documents }) : checking ? t('apps.loading') : '—',
                hint: status?.inbox != null ? t('apps.paperless.inboxHint', { count: status.inbox }) : undefined,
              },
              {
                label: t('apps.paperless.disk'),
                value: status?.diskTotal ? `${Math.round(((status.diskTotal - (status.diskFree ?? 0)) / status.diskTotal) * 100)}%` : '—',
                hint: status?.diskTotal ? t('apps.paperless.diskHint', { free: (status.diskFree! / 1024 ** 3).toFixed(1), size: (status.diskTotal / 1024 ** 3).toFixed(1) }) : t('apps.paperless.diskNeedsAdmin'),
              },
              {
                label: t('apps.paperless.key'),
                value: status ? t(status.isAdmin ? 'apps.paperless.keyAdmin' : 'apps.paperless.keyUser') : '—',
                hint: status?.failedTasks ? t('apps.paperless.failedTasks', { count: status.failedTasks }) : t('apps.paperless.keyHint'),
              },
            ]}
          >
            {error && <p className='Apps_section_note error'>{error}</p>}
            {status && !status.isAdmin && <p className='Apps_section_note'>{t('apps.paperless.notAdmin')}</p>}
            {status?.problems?.length ? <p className='Apps_section_note error'>{t('apps.paperless.problems', { parts: status.problems.join(', ') })}</p> : null}
          </App_Summary>

          <App_Updates accountId={account.id} appName={t('apps.paperless.title')} />

          <Update_Attempts accountId={account.id} label={label} />

          <App_Linked_Cards key={linkedVersion} type='APP' targetId={account.id} onOpen={setPanel} />
        </div>
      )}

      {account && panel && (
        <App_Modal onClose={closePanel}>
          {panel === 'account' && (
            <App_Account
              icon={<Icon.Paperless />}
              description={t('apps.paperless.accountDescription')}
              type={t('apps.paperless.title')}
              name={name}
              host={account.appHost}
              user={status?.profile ?? null}
              userLabel={t('apps.paperless.profile')}
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
                  {t('apps.paperless.replaceToken')}
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
        <Paperless_Account_Modal
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

export default Paperless_Account;
