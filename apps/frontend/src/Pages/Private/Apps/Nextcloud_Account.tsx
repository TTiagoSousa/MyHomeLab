import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import { useNextcloudStatus } from '../../../Hooks/ConnectedAccount/useNextcloudStatus';
import { Apps_Detail_Header } from './appsShared';
import App_Account from './App_Account';
import App_Location from './App_Location';
import App_Summary from './App_Summary';
import App_Updates from './App_Updates';
import App_Settings_Menu from './App_Settings_Menu';
import App_Modal from './App_Modal';
import App_Linked_Cards, { type App_Linked_Panel } from './App_Linked_Cards';
import { appSettingsItems } from './appSettingsItems';
import Linked_Docs from '../../../Components/Linked_Docs/Linked_Docs';
import Agent_Access from '../../../Components/Agent_Access/Agent_Access';
import Update_Attempts from '../../../Components/Update_Attempts/Update_Attempts';
import Linked_Schedules from '../../../Components/Linked_Schedules/Linked_Schedules';
import * as Icon from '../../../Imports/icons';

type Nextcloud_Panel = 'account' | App_Linked_Panel;

const PANEL_SECTIONS: Record<string, Nextcloud_Panel> = {
  account: 'account',
  location: 'account',
  agents: 'agents',
  docs: 'docs',
  schedules: 'schedules',
};

const Nextcloud_Account = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { connectedAccounts, loading, error: accountsError, fetchConnectedAccounts } = useConnectedAccounts('NEXTCLOUD');
  const { status, loading: checking, error, fetchStatus } = useNextcloudStatus(accountId);
  const { deleteConnectedAccount, loading: removing } = useConnectedAccount();
  const [panel, setPanel] = useState<Nextcloud_Panel | null>(null);
  const [linkedVersion, setLinkedVersion] = useState(0);

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? account?.caldavUsername ?? 'Nextcloud';
  const label = account?.displayName ? `Nextcloud · ${account.displayName}` : 'Nextcloud';
  const host = account?.appHost ?? account?.caldavHost ?? null;
  const isAdmin = status?.isAdmin ?? account?.isAdmin ?? false;
  const state = !account?.isActive ? 'off' : error ? 'error' : checking && !status ? 'checking' : status ? 'ok' : 'unknown';

  const disconnect = async () => {
    if (account && (await deleteConnectedAccount(account.id))) navigate('/MyHomeLab/Apps/Nextcloud');
  };

  const closePanel = () => {
    if (panel !== 'account') setLinkedVersion(linkedVersion + 1);
    setPanel(null);
  };

  const appsValue = () => {
    if (!status) return checking ? t('apps.loading') : '—';
    if (!status.isAdmin) return t('apps.nextcloud.appsNeedAdmin');
    return t('apps.nextcloud.appCount', { count: status.apps, updates: status.appUpdates.length });
  };

  const menuItems = appSettingsItems(['account', 'location', 'updates', 'agents', 'docs', 'schedules'], t, t('apps.nextcloud.credentialsHint')).map((item) =>
    PANEL_SECTIONS[item.id] ? { ...item, onSelect: () => setPanel(PANEL_SECTIONS[item.id]) } : item,
  );

  return (
    <div className='Apps'>
      <Apps_Detail_Header
        backTo='/MyHomeLab/Apps/Nextcloud'
        backLabel={t('apps.nextcloud.title')}
        title={name}
        helpTopic='nextcloud'
        actions={
          account && (
            <>
              <button type='button' className='Apps_header_button compact' onClick={() => navigate(`/MyHomeLab/Apps/Nextcloud/${accountId}/Connections`)}>
                {t('apps.nextcloud.connections.title')}
              </button>
              <App_Settings_Menu items={menuItems} />
            </>
          )
        }
      />

      {!account ? (
        <p className='Apps_intro'>{accountsError || (loading ? t('apps.loading') : t('apps.nextcloud.notFound'))}</p>
      ) : (
        <div className='Apps_list'>
          <App_Summary
            icon={<Icon.Nextcloud />}
            state={state}
            host={host}
            user={account.caldavUsername}
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
                label: t('apps.nextcloud.role'),
                value: isAdmin ? t('apps.nextcloud.admin') : t('apps.nextcloud.notAdmin'),
                hint: isAdmin ? t('apps.nextcloud.adminTooltip') : t('apps.nextcloud.adminHint'),
              },
              {
                label: t('apps.nextcloud.apps'),
                value: appsValue(),
                hint: status?.isAdmin ? t('apps.nextcloud.appsTooltip') : undefined,
              },
              {
                label: t('apps.nextcloud.maintenance'),
                value: status ? (status.maintenance || status.needsDbUpgrade ? t('apps.nextcloud.maintenanceOn') : t('apps.nextcloud.maintenanceOff')) : '—',
              },
            ]}
          >
            {error && <p className='Apps_section_note error'>{error}</p>}
            {status && !status.isAdmin && <p className='Apps_section_note'>{t('apps.nextcloud.adminHint')}</p>}
          </App_Summary>

          <App_Updates accountId={account.id} appName={t('apps.nextcloud.title')} />

          <Update_Attempts accountId={account.id} label={label} />

          <App_Linked_Cards key={linkedVersion} type='APP' targetId={account.id} onOpen={setPanel} />
        </div>
      )}

      {account && panel && (
        <App_Modal onClose={closePanel}>
          {panel === 'account' && (
            <App_Account
              icon={<Icon.Nextcloud />}
              description={t('apps.nextcloud.accountDescription')}
              type={t('apps.nextcloud.title')}
              name={name}
              host={host}
              user={account.caldavUsername}
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
              details={
                <>
                  <dt>{t('apps.nextcloud.role')}</dt>
                  <dd>{isAdmin ? t('apps.nextcloud.admin') : t('apps.nextcloud.notAdmin')}</dd>
                  {status?.isAdmin && (
                    <>
                      <dt>{t('apps.nextcloud.apps')}</dt>
                      <dd>{appsValue()}</dd>
                    </>
                  )}
                </>
              }
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

export default Nextcloud_Account;
