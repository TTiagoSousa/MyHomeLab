import './Apps.scss';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import { useAdguardStatus } from '../../../Hooks/ConnectedAccount/useAdguardStatus';
import { Apps_Detail_Header } from './appsShared';
import App_Account from './App_Account';
import App_Location from './App_Location';
import App_Updates from './App_Updates';
import App_Settings_Menu from './App_Settings_Menu';
import App_Cron_Button from './App_Cron_Button';
import Adguard_Settings from './Adguard_Settings';
import { appSettingsItems } from './appSettingsItems';
import Linked_Docs from '../../../Components/Linked_Docs/Linked_Docs';
import Agent_Access from '../../../Components/Agent_Access/Agent_Access';
import Update_Attempts from '../../../Components/Update_Attempts/Update_Attempts';
import Linked_Schedules from '../../../Components/Linked_Schedules/Linked_Schedules';
import * as Icon from '../../../Imports/icons';

const Adguard_Account = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { connectedAccounts, loading, error: accountsError, fetchConnectedAccounts } = useConnectedAccounts('ADGUARD');
  const { status, loading: checking, error, fetchStatus } = useAdguardStatus(accountId);
  const { deleteConnectedAccount, loading: removing } = useConnectedAccount();

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? account?.appHost ?? 'AdGuard';
  const label = account?.displayName ? `AdGuard · ${account.displayName}` : 'AdGuard';
  const blockedShare = status && status.queries ? ((status.blocked / status.queries) * 100).toFixed(1) : '0';
  const statsHours = status?.statsHours ?? null;
  const queriesLabel = !statsHours
    ? t('apps.adguard.queriesPeriod')
    : statsHours % 24 === 0
      ? t('apps.adguard.queriesDays', { count: statsHours / 24 })
      : t('apps.adguard.queriesHours', { count: Math.round(statsHours) });

  const disconnect = async () => {
    if (account && (await deleteConnectedAccount(account.id))) navigate('/MyHomeLab/Apps/AdGuard');
  };

  return (
    <div className='Apps'>
      <Apps_Detail_Header
        backTo='/MyHomeLab/Apps/AdGuard'
        backLabel={t('apps.adguard.title')}
        title={name}
        actions={
          account && (
            <div className='Apps_header_actions'>
              <App_Cron_Button to={`/MyHomeLab/Apps/AdGuard/${account.id}/Cron`} />
              <App_Settings_Menu
                items={appSettingsItems(['account', 'location', 'updates', 'agents', 'docs', 'schedules'], t, t('apps.adguard.credentialsHint'))}
              />
            </div>
          )
        }
      />

      {!account ? (
        <p className='Apps_intro'>{accountsError || (loading ? t('apps.loading') : t('apps.adguard.notFound'))}</p>
      ) : (
        <div className='Apps_list'>
          <App_Account
            icon={<Icon.Adguard />}
            description={t('apps.adguard.accountDescription')}
            type={t('apps.adguard.title')}
            name={name}
            host={account.appHost}
            user={account.username}
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
                  <dt>{t('apps.adguard.protection')}</dt>
                  <dd>{status.protectionEnabled ? t('apps.adguard.protectionOn') : t('apps.adguard.protectionOff')}</dd>
                  <dt>{queriesLabel}</dt>
                  <dd>{t('apps.adguard.queriesValue', { queries: status.queries, blocked: status.blocked, share: blockedShare })}</dd>
                  <dt>{t('apps.adguard.filters')}</dt>
                  <dd>{t('apps.adguard.filtersValue', { enabled: status.enabledFilters, total: status.filters, rules: status.rules })}</dd>
                  <dt>{t('apps.adguard.custom')}</dt>
                  <dd>{t('apps.adguard.customValue', { rules: status.userRules, allowlists: status.allowlists, rewrites: status.rewrites })}</dd>
                </>
              )
            }
            location={<App_Location account={account} onSaved={fetchConnectedAccounts} />}
          >
            <p className='Apps_section_note'>{t('apps.adguard.agentsHint')}</p>
            {error && <p className='Apps_section_note error'>{error}</p>}
          </App_Account>

          {status && <Adguard_Settings key={status.filtersInterval} accountId={account.id} status={status} onChanged={() => void fetchStatus()} />}

          <App_Updates accountId={account.id} appName={t('apps.adguard.title')} />

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

export default Adguard_Account;
