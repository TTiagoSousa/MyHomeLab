import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import { useClickHouseStatus } from '../../../Hooks/ConnectedAccount/useClickHouseStatus';
import { Apps_Detail_Header } from './appsShared';
import App_Account from './App_Account';
import App_Location from './App_Location';
import App_Summary from './App_Summary';
import App_Settings_Menu from './App_Settings_Menu';
import App_Modal from './App_Modal';
import App_Backups from './App_Backups';
import App_Linked_Cards, { type App_Linked_Panel } from './App_Linked_Cards';
import { appSettingsItems } from './appSettingsItems';
import { formatBytes, formatUptime } from '../Servers/format';
import ClickHouse_Account_Modal from '../../../Components/Modals/ClickHouse_Account_Modal/ClickHouse_Account_Modal';
import Linked_Docs from '../../../Components/Linked_Docs/Linked_Docs';
import Agent_Access from '../../../Components/Agent_Access/Agent_Access';
import Update_Attempts from '../../../Components/Update_Attempts/Update_Attempts';
import Linked_Schedules from '../../../Components/Linked_Schedules/Linked_Schedules';
import { dateLocale } from '../../../i18n';
import * as Icon from '../../../Imports/icons';

type ClickHouse_Panel = 'account' | App_Linked_Panel;

const PANEL_SECTIONS: Record<string, ClickHouse_Panel> = {
  account: 'account',
  location: 'account',
  agents: 'agents',
  docs: 'docs',
  schedules: 'schedules',
};

const ClickHouse_Account = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { connectedAccounts, loading, fetchConnectedAccounts } = useConnectedAccounts('CLICKHOUSE');
  const { status, loading: checking, error, fetchStatus } = useClickHouseStatus(accountId);
  const { deleteConnectedAccount, loading: removing } = useConnectedAccount();
  const [panel, setPanel] = useState<ClickHouse_Panel | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [linkedVersion, setLinkedVersion] = useState(0);

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? t('apps.clickhouse.title');
  const label = account?.displayName ? `ClickHouse · ${account.displayName}` : 'ClickHouse';
  const baseUrl = account?.appHost ? `https://${account.appHost}` : '';
  const state = !account?.isActive ? 'off' : error ? 'error' : checking && !status ? 'checking' : status ? 'ok' : 'unknown';

  const disconnect = async () => {
    if (account && (await deleteConnectedAccount(account.id))) navigate('/MyHomeLab/Apps/ClickHouse');
  };

  const closePanel = () => {
    if (panel !== 'account') setLinkedVersion(linkedVersion + 1);
    setPanel(null);
  };

  const menuItems = appSettingsItems(['account', 'location', 'backups', 'agents', 'docs', 'schedules'], t, t('apps.clickhouse.credentialsHint')).map(
    (item) => (PANEL_SECTIONS[item.id] ? { ...item, onSelect: () => setPanel(PANEL_SECTIONS[item.id]) } : item),
  );

  return (
    <div className='Apps'>
      <Apps_Detail_Header
        backTo='/MyHomeLab/Apps/ClickHouse'
        backLabel={t('apps.clickhouse.title')}
        title={name}
        actions={account && <App_Settings_Menu items={menuItems} />}
      />

      {!account ? (
        <p className='Apps_intro'>{loading ? t('apps.loading') : t('apps.clickhouse.notFound')}</p>
      ) : (
        <div className='Apps_list'>
          <App_Summary
            icon={<Icon.ClickHouse />}
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
                label: t('apps.clickhouse.databases'),
                value: status ? String(status.databases.length) : checking ? t('apps.loading') : '—',
                hint: status?.databases.length ? status.databases.slice(0, 6).join(' · ') : undefined,
              },
              {
                label: t('apps.clickhouse.storage'),
                value: status ? formatBytes(status.bytes) : '—',
                hint:
                  status && status.rows !== null
                    ? t('apps.clickhouse.storageHint', { rows: status.rows.toLocaleString(dateLocale()), tables: status.tables ?? 0 })
                    : undefined,
              },
              {
                label: t('apps.clickhouse.disk'),
                value: status?.diskFree != null ? t('apps.clickhouse.diskValue', { free: formatBytes(status.diskFree), total: formatBytes(status.diskTotal) }) : '—',
                hint: status ? t('apps.clickhouse.uptimeHint', { uptime: formatUptime(status.uptimeSeconds), running: status.running ?? 0 }) : undefined,
              },
            ]}
          >
            {error && <p className='Apps_section_note error'>{error}</p>}
            {account && !account.isAdmin && <p className='Apps_section_note'>{t('apps.clickhouse.notAdmin')}</p>}
          </App_Summary>

          <div id='app-backups'>
            <App_Backups
              accountId={account.id}
              serviceName={name}
              defaultFolder='ClickHouse'
              fileExample='clickhouse-2026-11-20_030000.json'
              textKey='addons:apps.clickhouse.backup'
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
              icon={<Icon.ClickHouse />}
              description={t('apps.clickhouse.accountDescription')}
              type={t('apps.clickhouse.title')}
              name={name}
              host={account.appHost}
              user={status?.profile ?? null}
              userLabel={t('apps.clickhouse.profile')}
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
                  {t('apps.clickhouse.replacePassword')}
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
        <ClickHouse_Account_Modal
          initialUrl={baseUrl}
          initialUsername={status?.profile ?? ''}
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

export default ClickHouse_Account;
