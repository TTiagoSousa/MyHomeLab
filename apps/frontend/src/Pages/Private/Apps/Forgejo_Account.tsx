import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import { useForgejoStatus } from '../../../Hooks/ConnectedAccount/useForgejoStatus';
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

type Forgejo_Panel = 'account' | App_Linked_Panel;

const PANEL_SECTIONS: Record<string, Forgejo_Panel> = {
  account: 'account',
  location: 'account',
  agents: 'agents',
  docs: 'docs',
  schedules: 'schedules',
};

const Forgejo_Account = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { connectedAccounts, loading, fetchConnectedAccounts } = useConnectedAccounts('FORGEJO');
  const { status, loading: checking, error, fetchStatus } = useForgejoStatus(accountId);
  const { deleteConnectedAccount, loading: removing } = useConnectedAccount();
  const [panel, setPanel] = useState<Forgejo_Panel | null>(null);
  const [linkedVersion, setLinkedVersion] = useState(0);

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? account?.username ?? 'Forgejo';
  const label = account?.displayName ? `Forgejo · ${account.displayName}` : 'Forgejo';
  const isAdmin = status?.isAdmin ?? account?.isAdmin ?? false;
  const state = !account?.isActive ? 'off' : error ? 'error' : checking && !status ? 'checking' : status ? 'ok' : 'unknown';

  const disconnect = async () => {
    if (account && (await deleteConnectedAccount(account.id))) navigate('/MyHomeLab/Apps/Forgejo');
  };

  const closePanel = () => {
    if (panel !== 'account') setLinkedVersion(linkedVersion + 1);
    setPanel(null);
  };

  const menuItems = appSettingsItems(['account', 'location', 'updates', 'agents', 'docs', 'schedules'], t, t('apps.forgejo.credentialsHint')).map(
    (item) => (PANEL_SECTIONS[item.id] ? { ...item, onSelect: () => setPanel(PANEL_SECTIONS[item.id]) } : item),
  );

  return (
    <div className='Apps'>
      <Apps_Detail_Header
        backTo='/MyHomeLab/Apps/Forgejo'
        backLabel={t('apps.forgejo.title')}
        title={name}
        helpTopic='forgejo'
        actions={
          account && (
            <>
              <button type='button' className='Apps_header_button compact' onClick={() => navigate(`/MyHomeLab/Apps/Forgejo/${accountId}/Connections`)}>
                {t('apps.forgejo.connections.title')}
              </button>
              <App_Settings_Menu items={menuItems} />
            </>
          )
        }
      />

      {!account ? (
        <p className='Apps_intro'>{loading ? t('apps.loading') : t('apps.forgejo.notFound')}</p>
      ) : (
        <div className='Apps_list'>
          <App_Summary
            icon={<Icon.HomeLab />}
            state={state}
            host={account.forgejoHost}
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
                label: t('apps.forgejo.role'),
                value: isAdmin ? t('apps.forgejo.admin') : t('apps.forgejo.notAdmin'),
                hint: isAdmin ? t('apps.forgejo.adminTooltip') : t('apps.forgejo.adminHint'),
              },
              {
                label: t('apps.forgejo.repositories'),
                value: status ? t('apps.forgejo.repositoryCount', { count: status.repositories, private: status.privateRepositories }) : checking ? t('apps.loading') : '—',
                hint: status ? t('apps.forgejo.repositoriesTooltip') : undefined,
              },
            ]}
          >
            {error && <p className='Apps_section_note error'>{error}</p>}
          </App_Summary>

          <App_Updates accountId={account.id} appName={t('apps.forgejo.title')} />

          <Update_Attempts accountId={account.id} label={label} />

          <App_Linked_Cards key={linkedVersion} type='APP' targetId={account.id} onOpen={setPanel} />
        </div>
      )}

      {account && panel && (
        <App_Modal onClose={closePanel}>
          {panel === 'account' && (
            <App_Account
              icon={<Icon.HomeLab />}
              description={t('apps.forgejo.accountDescription')}
              type={t('apps.forgejo.title')}
              name={name}
              host={account.forgejoHost}
              user={account.username}
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
                  <dt>{t('apps.forgejo.role')}</dt>
                  <dd>{isAdmin ? t('apps.forgejo.admin') : t('apps.forgejo.notAdmin')}</dd>
                  {status && (
                    <>
                      <dt>{t('apps.forgejo.repositories')}</dt>
                      <dd>{t('apps.forgejo.repositoryCount', { count: status.repositories, private: status.privateRepositories })}</dd>
                    </>
                  )}
                </>
              }
              location={<App_Location account={account} onSaved={fetchConnectedAccounts} />}
            >
              {status && !status.isAdmin && <p className='Apps_section_note'>{t('apps.forgejo.adminHint')}</p>}
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

export default Forgejo_Account;
