import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import { useVaultwardenStatus } from '../../../Hooks/ConnectedAccount/useVaultwardenStatus';
import { Apps_Detail_Header } from './appsShared';
import App_Account from './App_Account';
import App_Location from './App_Location';
import App_Summary from './App_Summary';
import App_Settings_Menu from './App_Settings_Menu';
import App_Modal from './App_Modal';
import App_Backups from './App_Backups';
import App_Linked_Cards, { type App_Linked_Panel } from './App_Linked_Cards';
import { appSettingsItems } from './appSettingsItems';
import Vaultwarden_Account_Modal from '../../../Components/Modals/Vaultwarden_Account_Modal/Vaultwarden_Account_Modal';
import Linked_Docs from '../../../Components/Linked_Docs/Linked_Docs';
import Agent_Access from '../../../Components/Agent_Access/Agent_Access';
import Update_Attempts from '../../../Components/Update_Attempts/Update_Attempts';
import Linked_Schedules from '../../../Components/Linked_Schedules/Linked_Schedules';
import * as Icon from '../../../Imports/icons';

type Vaultwarden_Panel = 'account' | App_Linked_Panel;

const PANEL_SECTIONS: Record<string, Vaultwarden_Panel> = {
  account: 'account',
  location: 'account',
  agents: 'agents',
  docs: 'docs',
  schedules: 'schedules',
};

const Vaultwarden_Account = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { connectedAccounts, loading, fetchConnectedAccounts } = useConnectedAccounts('VAULTWARDEN');
  const { status, loading: checking, error, fetchStatus } = useVaultwardenStatus(accountId);
  const { deleteConnectedAccount, loading: removing } = useConnectedAccount();
  const [panel, setPanel] = useState<Vaultwarden_Panel | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [linkedVersion, setLinkedVersion] = useState(0);

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? t('apps.vaultwarden.title');
  const label = account?.displayName ? `Vaultwarden · ${account.displayName}` : 'Vaultwarden';
  const baseUrl = account?.appHost ? `https://${account.appHost}` : '';
  const state = !account?.isActive ? 'off' : error ? 'error' : checking && !status ? 'checking' : status ? 'ok' : 'unknown';

  const disconnect = async () => {
    if (account && (await deleteConnectedAccount(account.id))) navigate('/MyHomeLab/Apps/Vaultwarden');
  };

  const closePanel = () => {
    if (panel !== 'account') setLinkedVersion(linkedVersion + 1);
    setPanel(null);
  };

  const menuItems = appSettingsItems(['account', 'location', 'backups', 'agents', 'docs', 'schedules'], t, t('apps.vaultwarden.credentialsHint')).map((item) =>
    PANEL_SECTIONS[item.id] ? { ...item, onSelect: () => setPanel(PANEL_SECTIONS[item.id]) } : item,
  );

  return (
    <div className='Apps'>
      <Apps_Detail_Header
        backTo='/MyHomeLab/Apps/Vaultwarden'
        backLabel={t('apps.vaultwarden.title')}
        title={name}
        actions={account && <App_Settings_Menu items={menuItems} />}
      />

      {!account ? (
        <p className='Apps_intro'>{loading ? t('apps.loading') : t('apps.vaultwarden.notFound')}</p>
      ) : (
        <div className='Apps_list'>
          <App_Summary
            icon={<Icon.Vaultwarden />}
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
                label: t('apps.vaultwarden.users'),
                value: status ? String(status.users) : checking ? t('apps.loading') : '—',
                hint: status ? t('apps.vaultwarden.usersHint', { invited: status.invited, disabled: status.disabled }) : undefined,
              },
              {
                label: t('apps.vaultwarden.twoFactor'),
                value: status ? (status.withoutTwoFactor ? t('apps.vaultwarden.withoutTwoFactor', { count: status.withoutTwoFactor }) : t('apps.vaultwarden.allTwoFactor')) : '—',
                hint: t('apps.vaultwarden.twoFactorHint'),
              },
              {
                label: t('apps.vaultwarden.organizations'),
                value: status ? String(status.organizations) : '—',
                hint: status
                  ? [
                      status.database ? t('apps.vaultwarden.database', { kind: status.database }) : '',
                      status.signupsAllowed === null ? '' : t(status.signupsAllowed ? 'apps.vaultwarden.signupsOpen' : 'apps.vaultwarden.signupsClosed'),
                    ]
                      .filter(Boolean)
                      .join(' · ') || undefined
                  : undefined,
              },
            ]}
          >
            {error && <p className='Apps_section_note error'>{error}</p>}
            <p className='Apps_section_note'>{t('apps.vaultwarden.vaultNote')}</p>
          </App_Summary>

          <div id='app-backups'>
            <App_Backups
              accountId={account.id}
              serviceName={name}
              defaultFolder='Vaultwarden'
              fileExample='vaultwarden-2026-11-20_030000.json'
              textKey='addons:apps.vaultwarden.backup'
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
              icon={<Icon.Vaultwarden />}
              description={t('apps.vaultwarden.accountDescription')}
              type={t('apps.vaultwarden.title')}
              name={name}
              host={account.appHost}
              user={account.displayName ?? null}
              userLabel={t('apps.vaultwarden.profile')}
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
                  {t('apps.vaultwarden.replaceToken')}
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
        <Vaultwarden_Account_Modal
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

export default Vaultwarden_Account;
