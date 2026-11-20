import './Apps.scss';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import { useHomeAssistantStatus } from '../../../Hooks/ConnectedAccount/useHomeAssistantStatus';
import { Apps_Detail_Header } from './appsShared';
import App_Account from './App_Account';
import App_Location from './App_Location';
import App_Updates from './App_Updates';
import App_Settings_Menu from './App_Settings_Menu';
import { appSettingsItems } from './appSettingsItems';
import Linked_Docs from '../../../Components/Linked_Docs/Linked_Docs';
import Agent_Access from '../../../Components/Agent_Access/Agent_Access';
import Update_Attempts from '../../../Components/Update_Attempts/Update_Attempts';
import Linked_Schedules from '../../../Components/Linked_Schedules/Linked_Schedules';
import * as Icon from '../../../Imports/icons';

const Home_Assistant_Account = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { connectedAccounts, loading, fetchConnectedAccounts } = useConnectedAccounts('HOME_ASSISTANT');
  const { status, loading: checking, error, fetchStatus } = useHomeAssistantStatus(accountId);
  const { deleteConnectedAccount, loading: removing } = useConnectedAccount();

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? account?.appHost ?? 'Home Assistant';
  const label = account?.displayName ? `Home Assistant · ${account.displayName}` : 'Home Assistant';

  const disconnect = async () => {
    if (account && (await deleteConnectedAccount(account.id))) navigate('/MyHomeLab/Apps/HomeAssistant');
  };

  return (
    <div className='Apps'>
      <Apps_Detail_Header
        backTo='/MyHomeLab/Apps/HomeAssistant'
        backLabel={t('apps.homeAssistant.title')}
        title={name}
        actions={
          account && (
            <>
              <button type='button' className='Apps_header_button compact' onClick={() => navigate(`/MyHomeLab/Apps/HomeAssistant/${accountId}/Connections`)}>
                {t('apps.homeAssistant.connections.title')}
              </button>
              <App_Settings_Menu
                items={appSettingsItems(['account', 'location', 'updates', 'agents', 'docs', 'schedules'], t, t('apps.homeAssistant.credentialsHint'))}
              />
            </>
          )
        }
      />

      {!account ? (
        <p className='Apps_intro'>{loading ? t('apps.loading') : t('apps.homeAssistant.notFound')}</p>
      ) : (
        <div className='Apps_list'>
          <App_Account
            icon={<Icon.HomeAssistant />}
            description={t('apps.homeAssistant.accountDescription')}
            type={t('apps.homeAssistant.title')}
            name={name}
            host={account.appHost}
            user={status?.user ?? account.username}
            version={status?.version ?? account.appVersion ?? null}
            latestVersion={status?.latestVersion ?? account.appLatestVersion}
            latestUrl={status?.latestUrl ?? account.appLatestUrl}
            state={!account.isActive ? 'off' : error ? 'error' : checking && !status ? 'checking' : status ? 'ok' : 'unknown'}
            since={account.createdAt}
            checkedAt={account.appCheckedAt ?? null}
            checking={checking}
            onCheck={() => void fetchStatus()}
            removing={removing}
            onDisconnect={disconnect}
            details={
              status && (
                <>
                  <dt>{t('apps.homeAssistant.entities')}</dt>
                  <dd>{t('apps.homeAssistant.entitiesValue', { entities: status.entities, devices: status.devices, areas: status.areas })}</dd>
                  <dt>{t('apps.homeAssistant.configs')}</dt>
                  <dd>{t('apps.homeAssistant.configsValue', { automations: status.automations, scripts: status.scripts, scenes: status.scenes })}</dd>
                  <dt>{t('apps.homeAssistant.pendingUpdates')}</dt>
                  <dd>{status.pendingUpdates}</dd>
                </>
              )
            }
            location={<App_Location account={account} onSaved={fetchConnectedAccounts} />}
          >
            <p className='Apps_section_note'>{t('apps.homeAssistant.agentsHint')}</p>
            {error && <p className='Apps_section_note error'>{error}</p>}
          </App_Account>

          <App_Updates accountId={account.id} appName={t('apps.homeAssistant.title')} />

          <Update_Attempts accountId={account.id} label={label} />

          <div id='app-agents'>
            <Agent_Access type='APP' targetId={account.id} label={label} />
          </div>
          <div id='app-docs'>
            <Linked_Docs type='APP' targetId={account.id} label={label} />
          </div>
          <div id='app-schedules'>
            <Linked_Schedules type='APP' targetId={account.id} label={label} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Home_Assistant_Account;
