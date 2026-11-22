import './Apps.scss';
import './Tplink_Router.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import { useTplinkRouterStatus } from '../../../Hooks/ConnectedAccount/useTplinkRouterStatus';
import { useTplinkRouterAction, type TplinkRouterActionPayload } from '../../../Hooks/ConnectedAccount/useTplinkRouterAction';
import { Apps_Detail_Header } from './appsShared';
import App_Account from './App_Account';
import App_Location from './App_Location';
import App_Summary from './App_Summary';
import App_Settings_Menu from './App_Settings_Menu';
import App_Modal from './App_Modal';
import App_Linked_Cards, { type App_Linked_Panel } from './App_Linked_Cards';
import { appSettingsItems } from './appSettingsItems';
import Tplink_Router_Connection from './Tplink_Router_Connection';
import Tplink_Router_Overview from './Tplink_Router_Overview';
import Tplink_Router_Wifi from './Tplink_Router_Wifi';
import Tplink_Router_Devices from './Tplink_Router_Devices';
import Tplink_Router_Dhcp from './Tplink_Router_Dhcp';
import Tplink_Router_Port_Forwards from './Tplink_Router_Port_Forwards';
import Tplink_Router_Access from './Tplink_Router_Access';
import Linked_Docs from '../../../Components/Linked_Docs/Linked_Docs';
import Agent_Access from '../../../Components/Agent_Access/Agent_Access';
import Update_Attempts from '../../../Components/Update_Attempts/Update_Attempts';
import Linked_Schedules from '../../../Components/Linked_Schedules/Linked_Schedules';
import * as Icon from '../../../Imports/icons';
import { accountKind, formatSignal } from './tplinkRouterFormat';

type Tplink_Router_Panel = 'account' | App_Linked_Panel;
type Tplink_Router_Tab = 'overview' | 'wifi' | 'devices' | 'dhcp' | 'ports' | 'access';

const TABS: Tplink_Router_Tab[] = ['overview', 'wifi', 'devices', 'dhcp', 'ports', 'access'];

const PANEL_SECTIONS: Record<string, Tplink_Router_Panel> = {
  account: 'account',
  location: 'account',
  agents: 'agents',
  docs: 'docs',
  schedules: 'schedules',
};

const Tplink_Router_Account = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { connectedAccounts, loading, error: accountsError, fetchConnectedAccounts } = useConnectedAccounts('TPLINK_ROUTER');
  const { status, loading: checking, error, fetchStatus } = useTplinkRouterStatus(accountId);
  const { running, runAction } = useTplinkRouterAction(accountId);
  const { deleteConnectedAccount, loading: removing } = useConnectedAccount();
  const [panel, setPanel] = useState<Tplink_Router_Panel | null>(null);
  const [tab, setTab] = useState<Tplink_Router_Tab>('overview');
  const [linkedVersion, setLinkedVersion] = useState(0);

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? t('apps.tplinkRouter.title');
  const label = account?.displayName ? `TP-Link Archer · ${account.displayName}` : 'TP-Link Archer';
  const connection = status?.connection ?? null;
  const router = status?.router ?? null;
  const kind = router?.kind ?? connection?.kind ?? accountKind(account?.scopes);
  const extender = kind === 'extender';
  const kindLabel = t(`apps.tplinkRouter.kinds.${kind}`);
  const visibleTabs = TABS.filter(
    (item) => !extender || item === 'overview' || item === 'wifi' || item === 'devices' || (item === 'dhcp' && Boolean(router?.leases.length)),
  );
  const activeTab = visibleTabs.includes(tab) ? tab : 'overview';
  const wired = Boolean(router?.repeater?.wired?.connected);
  const backhaul = router?.repeater ? [router.repeater.band5g, router.repeater.band2g].find((band) => band.connected) : undefined;

  const state = !account?.isActive
    ? 'off'
    : error || connection?.state === 'failed'
      ? 'error'
      : connection?.state === 'connected'
        ? 'ok'
        : connection?.state === 'disconnected'
          ? 'checking'
          : checking
            ? 'checking'
            : 'unknown';
  const stateLabel = account?.isActive && connection && !error ? t(`apps.tplinkRouter.states.${connection.state}`) : undefined;
  const stateHint = account?.isActive && connection && !error ? t(`apps.tplinkRouter.stateHints.${connection.state}`) : undefined;

  const disconnect = async () => {
    if (account && (await deleteConnectedAccount(account.id))) navigate('/MyHomeLab/Apps/TplinkRouter');
  };

  const closePanel = () => {
    if (panel !== 'account') setLinkedVersion(linkedVersion + 1);
    setPanel(null);
  };

  const act = async (payload: TplinkRouterActionPayload) => {
    const ok = await runAction(payload);
    await fetchStatus();
    return ok;
  };

  const tabCount = (item: Tplink_Router_Tab) => {
    if (!router) return null;
    if (item === 'devices') return router.status.devices.length;
    if (item === 'dhcp') return extender ? router.leases.length : router.reservations.length;
    if (item === 'ports') return router.portForwards.length;
    if (item === 'access') return router.blocked.length;
    return null;
  };

  const menuItems = appSettingsItems(['account', 'location', 'agents', 'docs', 'schedules'], t, t('apps.tplinkRouter.credentialsHint')).map((item) =>
    PANEL_SECTIONS[item.id] ? { ...item, onSelect: () => setPanel(PANEL_SECTIONS[item.id]) } : item,
  );

  const totalDevices = router ? router.status.wiredTotal + router.status.wifiTotal + router.status.guestTotal + router.status.iotTotal : null;

  return (
    <div className='Apps Tplink_Router'>
      <Apps_Detail_Header
        backTo='/MyHomeLab/Apps/TplinkRouter'
        backLabel={t('apps.tplinkRouter.title')}
        title={name}
        actions={account && <App_Settings_Menu items={menuItems} />}
      />

      {!account ? (
        <p className='Apps_intro'>{accountsError || (loading ? t('apps.loading') : t('apps.tplinkRouter.notFound'))}</p>
      ) : (
        <div className='Apps_list'>
          <App_Summary
            icon={<Icon.TplinkRouter />}
            state={state}
            stateLabel={stateLabel}
            stateHint={stateHint}
            host={account.appHost}
            user={account.username ?? account.displayName}
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
                label: t('apps.tplinkRouter.kind'),
                value: kindLabel,
                hint: extender ? t('apps.tplinkRouter.kindHints.extender') : t('apps.tplinkRouter.kindHints.router'),
              },
              {
                label: t('apps.tplinkRouter.model'),
                value: router?.firmware.model || (checking && !status ? t('apps.loading') : '—'),
                hint: router?.firmware.hardwareVersion ? t('apps.tplinkRouter.modelHint', { hardware: router.firmware.hardwareVersion }) : undefined,
              },
              extender
                ? {
                    label: t('apps.tplinkRouter.backhaulFact'),
                    value: router ? (wired || backhaul ? t('apps.tplinkRouter.backhaul.connected') : t('apps.tplinkRouter.backhaul.disconnected')) : '—',
                    hint: wired
                      ? t('apps.tplinkRouter.backhaul.wired')
                      : backhaul
                        ? [backhaul.ssid, formatSignal(backhaul.rssi)].filter(Boolean).join(' · ')
                        : undefined,
                  }
                : {
                    label: t('apps.tplinkRouter.internet'),
                    value: router?.status.wanIp || '—',
                    hint: router
                      ? t('apps.tplinkRouter.internetHint', { type: router.status.wanConnType || '—', gateway: router.status.wanGateway || '—' })
                      : undefined,
                  },
              {
                label: t('apps.tplinkRouter.devicesFact'),
                value: totalDevices == null ? '—' : String(totalDevices),
                hint: router
                  ? t('apps.tplinkRouter.devicesHint', {
                      wired: router.status.wiredTotal,
                      wifi: router.status.wifiTotal,
                      guest: router.status.guestTotal,
                      iot: router.status.iotTotal,
                    })
                  : undefined,
              },
            ]}
          >
            {error && <p className='Apps_section_note error'>{error}</p>}
            {connection && connection.state !== 'connected' && (
              <Tplink_Router_Connection
                connection={connection}
                checking={checking}
                onConnect={() => void fetchStatus(true)}
                onOpenAccount={() => setPanel('account')}
              />
            )}
          </App_Summary>

          {router && (
            <section className='Apps_section Tplink_Router_Section' id='tplink-router-sections'>
              <div className='Tplink_Router_Tabs' role='tablist'>
                {visibleTabs.map((item) => {
                  const count = tabCount(item);
                  return (
                    <button
                      key={item}
                      type='button'
                      role='tab'
                      aria-selected={activeTab === item}
                      className={activeTab === item ? 'active' : ''}
                      onClick={() => setTab(item)}
                    >
                      <span>{t(`apps.tplinkRouter.tabs.${item}`)}</span>
                      {count != null && <span className='Tplink_Router_Tab_Count'>{count}</span>}
                    </button>
                  );
                })}
              </div>

              <div className='Tplink_Router_Tab_Body' role='tabpanel'>
                {activeTab === 'overview' && <Tplink_Router_Overview router={router} running={running} onAction={act} />}
                {activeTab === 'wifi' && <Tplink_Router_Wifi router={router} running={running} onAction={act} />}
                {activeTab === 'devices' && <Tplink_Router_Devices router={router} running={running} onAction={act} />}
                {activeTab === 'dhcp' && <Tplink_Router_Dhcp router={router} running={running} onAction={act} />}
                {activeTab === 'ports' && <Tplink_Router_Port_Forwards router={router} running={running} onAction={act} />}
                {activeTab === 'access' && (
                  <Tplink_Router_Access
                    key={`${router.accessControl?.enabled}-${router.accessControl?.mode}`}
                    router={router}
                    running={running}
                    onAction={act}
                  />
                )}
              </div>
            </section>
          )}

          <Update_Attempts accountId={account.id} label={label} />

          <App_Linked_Cards key={linkedVersion} type='APP' targetId={account.id} onOpen={setPanel} />
        </div>
      )}

      {account && panel && (
        <App_Modal onClose={closePanel}>
          {panel === 'account' && (
            <App_Account
              icon={<Icon.TplinkRouter />}
              description={t('apps.tplinkRouter.accountDescription')}
              type={t('apps.tplinkRouter.typeValue', { kind: kindLabel })}
              name={name}
              host={account.appHost}
              user={account.username ?? null}
              version={status?.version ?? account.appVersion ?? null}
              latestVersion={account.appLatestVersion}
              latestUrl={account.appLatestUrl}
              state={state}
              since={account.createdAt}
              checkedAt={account.appCheckedAt ?? null}
              checking={checking}
              onCheck={() => void fetchStatus(true)}
              removing={removing}
              onDisconnect={disconnect}
              location={<App_Location account={account} onSaved={fetchConnectedAccounts} />}
            >
              {connection?.state === 'failed' && <p className='Apps_section_note error'>{t('apps.tplinkRouter.connection.reconnectHint')}</p>}
            </App_Account>
          )}
          {panel === 'agents' && <Agent_Access type='APP' targetId={account.id} label={label} />}
          {panel === 'docs' && <Linked_Docs type='APP' targetId={account.id} label={label} />}
          {panel === 'schedules' && <Linked_Schedules type='APP' targetId={account.id} label={label} />}
        </App_Modal>
      )}
    </div>
  );
};

export default Tplink_Router_Account;
