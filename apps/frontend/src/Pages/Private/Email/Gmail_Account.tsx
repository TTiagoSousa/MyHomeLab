import '../Apps/Apps.scss';
import './Gmail_Account.scss';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useConnectedAccounts, type RunFrequency } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import { useEmailRules } from '../../../Hooks/EmailRule/useEmailRules';
import { useEmailRule, type RunScope } from '../../../Hooks/EmailRule/useEmailRule';
import { useGmailStats } from '../../../Hooks/ConnectedAccount/useGmailStats';
import { useRuleProposals } from '../../../Hooks/EmailRule/useRuleProposals';
import { Apps_Detail_Header, Apps_Section, Frequency_Select } from '../Apps/appsShared';
import App_Account from '../Apps/App_Account';
import App_Settings_Menu from '../Apps/App_Settings_Menu';
import { appSettingsItems } from '../Apps/appSettingsItems';
import { formatRelativeTime } from '../Apps/relativeTime';
import Proposal_Settings from './Proposal_Settings';
import Linked_Docs from '../../../Components/Linked_Docs/Linked_Docs';
import Agent_Access from '../../../Components/Agent_Access/Agent_Access';
import Linked_Schedules from '../../../Components/Linked_Schedules/Linked_Schedules';
import * as Icon from '../../../Imports/icons';
import { dateLocale } from '../../../i18n';

const formatStat = (value: number | undefined) => (value === undefined ? '—' : value.toLocaleString(dateLocale()));

const Gmail_Account = () => {
  const { t } = useTranslation('email');
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { connectedAccounts, loading, fetchConnectedAccounts } = useConnectedAccounts('GMAIL');
  const { deleteConnectedAccount, updateRunFrequency, updateProposalSettings, loading: removing } = useConnectedAccount();
  const { emailRules } = useEmailRules(accountId ?? '');
  const { pending: proposals } = useRuleProposals(accountId ?? null);
  const { runEmailRules, loading: running } = useEmailRule(accountId ?? '');
  const { gmailStats, loading: statsLoading, fetchGmailStats } = useGmailStats(accountId ?? null);

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.emailAddress ?? t('account.fallbackTitle');

  const changeFrequency = async (runFrequency: RunFrequency) => {
    if (account && (await updateRunFrequency(account.id, runFrequency))) fetchConnectedAccounts();
  };

  const run = async (scope: RunScope) => {
    await runEmailRules(scope);
    await fetchGmailStats();
    fetchConnectedAccounts();
  };

  const disconnect = async () => {
    if (account && (await deleteConnectedAccount(account.id))) navigate('/MyHomeLab/Apps/Gmail');
  };

  const stats = [
    { key: 'inbox', value: gmailStats?.inboxTotal, tone: 'attention' },
    { key: 'read', value: gmailStats?.inboxRead, tone: 'positive' },
    { key: 'all', value: gmailStats?.mailboxTotal, tone: 'neutral' },
  ];

  return (
    <div className='Apps'>
      <Apps_Detail_Header
        backTo='/MyHomeLab/Apps/Gmail'
        backLabel={t('page.title')}
        title={name}
        actions={
          account && (
            <App_Settings_Menu
              items={appSettingsItems(['account', 'rules', 'proposals', 'agents', 'docs', 'schedules'], t, t('addons:apps.gmail.credentialsHint'))}
            />
          )
        }
      />

      {!account ? (
        <p className='Apps_intro'>{loading ? t('account.loading') : t('account.notFound')}</p>
      ) : (
        <div className='Apps_list'>
          <App_Account
            icon={<Icon.Mail />}
            description={t('page.organizerDescription')}
            type={t('addons:apps.gmail.title')}
            name={name}
            user={account.emailAddress}
            state={account.isActive ? 'ok' : 'off'}
            since={account.createdAt}
            checkedAt={account.lastRunAt}
            removing={removing}
            onDisconnect={disconnect}
          >
            <div className='Gmail_stats'>
              {stats.map((stat) => (
                <div key={stat.key} className={`Gmail_stat ${stat.tone}`}>
                  <span className='Gmail_stat_value'>{formatStat(stat.value)}</span>
                  <span className='Gmail_stat_label'>{t(`account.stats.${stat.key}`)}</span>
                </div>
              ))}
              <button
                type='button'
                className={`Gmail_stat_refresh${statsLoading ? ' loading' : ''}`}
                disabled={statsLoading}
                onClick={() => void fetchGmailStats({ notifyOnError: true })}
                title={t('account.stats.refresh')}
                aria-label={t('account.stats.refresh')}
              >
                <Icon.Refresh />
              </button>
            </div>
          </App_Account>

          <Apps_Section
            id='app-rules'
            icon={<Icon.Doc />}
            title={t('account.sections.rules')}
            description={t('account.meta', {
              rules: t('account.rules', { count: emailRules.length }),
              lastRun: formatRelativeTime(account.lastRunAt, t),
            })}
          >
            <div className='Apps_fields'>
              <div className='Apps_field'>
                <label>{t('account.frequency')}</label>
                <Frequency_Select value={account.runFrequency} onChange={changeFrequency} />
              </div>
            </div>

            <div className='Apps_footer'>
              <button type='button' disabled={running} onClick={() => run('INBOX')}>
                {t('run.inbox')}
              </button>
              <button type='button' disabled={running} onClick={() => run('ALL')}>
                {t('run.all')}
              </button>
              <button type='button' className='active' onClick={() => navigate(`/MyHomeLab/Apps/Gmail/Rules?account=${account.id}`)}>
                {t('account.viewRules')}
              </button>
            </div>
          </Apps_Section>

          <Apps_Section
            id='app-proposals'
            icon={<Icon.Star />}
            title={t('account.sections.proposals')}
            description={t('account.proposalsMeta', {
              pending: t('account.pending', { count: proposals.length }),
              lastAnalysis: formatRelativeTime(account.lastProposalRunAt, t),
            })}
          >
            <Proposal_Settings
              account={account}
              onSave={async (changes) => {
                const success = await updateProposalSettings(account.id, changes);
                if (success) fetchConnectedAccounts();
                return success;
              }}
            />

            <div className='Apps_footer'>
              <button type='button' className='active' onClick={() => navigate(`/MyHomeLab/Apps/Gmail/${account.id}/proposals`)}>
                {t('account.viewProposals', { count: proposals.length })}
              </button>
            </div>
          </Apps_Section>

          <div id='app-agents'>
            <Agent_Access type='APP' targetId={account.id} label={`Gmail · ${name}`} />
          </div>
          <div id='app-docs'>
            <Linked_Docs type='APP' targetId={account.id} label={`Gmail · ${name}`} />
          </div>
          <div id='app-schedules'>
            <Linked_Schedules type='APP' targetId={account.id} label={`Gmail · ${name}`} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Gmail_Account;
