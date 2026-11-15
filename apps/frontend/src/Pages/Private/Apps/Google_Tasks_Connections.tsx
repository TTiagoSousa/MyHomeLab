import './Apps.scss';
import '../Email/Gmail_Connections.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConnectedAccounts, type ConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { Apps_Detail_Header, Apps_Section } from './appsShared';
import * as Icon from '../../../Imports/icons';
import {
  GOOGLE_TASKS_API_BASE_PATH,
  GOOGLE_TASKS_POSSIBLE_CALLS,
  GOOGLE_TASKS_SCOPES,
  GOOGLE_TASKS_USED_CALLS,
  shortScope,
  type Google_Tasks_Api_Call,
} from './googleTasksApiCalls';

type Call_Filter = 'all' | 'used' | 'possible';

const FILTERS: Call_Filter[] = ['all', 'used', 'possible'];

const CALL_COLUMNS = ['method', 'path', 'description', 'usedBy', 'scope', 'status'] as const;

const callsFor = (filter: Call_Filter) => {
  if (filter === 'used') return GOOGLE_TASKS_USED_CALLS;
  if (filter === 'possible') return GOOGLE_TASKS_POSSIBLE_CALLS;
  return [...GOOGLE_TASKS_USED_CALLS, ...GOOGLE_TASKS_POSSIBLE_CALLS];
};

const accountName = (account: ConnectedAccount) => account.emailAddress?.split('@')[0] ?? account.id;

const Call_Status = ({ call, accounts }: { call: Google_Tasks_Api_Call; accounts: ConnectedAccount[] }) => {
  const { t } = useTranslation('addons');
  const allowed = accounts.filter((account) => call.scopes.some((value) => account.scopes.includes(value))).length;

  if (allowed === accounts.length) return <span className='Gmail_Table_Status on'>{t('apps.googleTasks.connections.allowed')}</span>;
  if (allowed === 0) return <span className='Gmail_Table_Status off'>{t('apps.googleTasks.connections.missing')}</span>;
  return <span className='Gmail_Table_Status partial'>{t('apps.googleTasks.connections.partial', { count: allowed, total: accounts.length })}</span>;
};

const Scopes_Table = ({ accounts }: { accounts: ConnectedAccount[] }) => {
  const { t } = useTranslation('addons');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            <th>{t('apps.googleTasks.connections.table.scope')}</th>
            <th>{t('apps.googleTasks.connections.table.allows')}</th>
            {accounts.map((account) => (
              <th key={account.id} className='center' title={account.emailAddress ?? undefined}>
                {accountName(account)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GOOGLE_TASKS_SCOPES.map((item) => (
            <tr key={item.id}>
              <td>
                <code title={item.value}>{shortScope(item.value)}</code>
              </td>
              <td>{t(`apps.googleTasks.connections.scopes.${item.id}`)}</td>
              {accounts.map((account) => {
                const granted = account.scopes.includes(item.value);
                const includedIn = granted ? undefined : item.includedIn.find((value) => account.scopes.includes(value));
                return (
                  <td key={account.id} className='center'>
                    {includedIn ? (
                      <span className='Gmail_Table_Faint'>{t('apps.googleTasks.connections.includedIn', { scope: shortScope(includedIn) })}</span>
                    ) : (
                      <span className={`Gmail_Table_Check ${granted ? 'on' : 'off'}`} aria-label={t(granted ? 'apps.googleTasks.connections.granted' : 'apps.googleTasks.connections.notGranted')}>
                        {granted ? '✓' : '—'}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Calls_Table = ({ calls, accounts }: { calls: Google_Tasks_Api_Call[]; accounts: ConnectedAccount[] }) => {
  const { t } = useTranslation('addons');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            {CALL_COLUMNS.map((column) => (
              <th key={column}>{t(`apps.googleTasks.connections.table.${column}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calls.map((call) => (
            <tr key={call.id} className={call.usedBy.length ? '' : 'possible'}>
              <td>
                <span className={`Gmail_Table_Method ${call.method.toLowerCase()}`}>{call.method}</span>
              </td>
              <td>
                <code>{call.path}</code>
              </td>
              <td className='Gmail_Table_Description'>{t(`apps.googleTasks.connections.calls.${call.id}`)}</td>
              <td>
                {call.usedBy.length ? (
                  <span className='Gmail_Table_Tags'>
                    {call.usedBy.map((consumer) => (
                      <span key={consumer}>{t(`apps.googleTasks.connections.usedBy.${consumer}`)}</span>
                    ))}
                  </span>
                ) : (
                  <span className='Gmail_Table_Faint'>{t('apps.googleTasks.connections.notUsed')}</span>
                )}
              </td>
              <td>
                <code title={call.scopes.map(shortScope).join(' · ')}>{shortScope(call.scopes[0])}</code>
              </td>
              <td>
                <Call_Status call={call} accounts={accounts} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Google_Tasks_Connections = () => {
  const { t } = useTranslation('addons');
  const { connectedAccounts, loading } = useConnectedAccounts('GOOGLE_TASKS');
  const [filter, setFilter] = useState<Call_Filter>('all');

  return (
    <div className='Apps'>
      <Apps_Detail_Header backTo='/MyHomeLab/Apps/GoogleTasks' backLabel={t('apps.googleTasks.title')} title={t('apps.googleTasks.connections.title')} />

      {!connectedAccounts.length ? (
        <p className='Apps_intro'>{loading ? t('apps.loading') : t('apps.googleTasks.connections.noAccounts')}</p>
      ) : (
        <div className='Apps_list'>
          <Apps_Section icon={<Icon.Shield />} title={t('apps.googleTasks.connections.permissionsTitle')} description={t('apps.googleTasks.connections.permissionsSummary')}>
            <Scopes_Table accounts={connectedAccounts} />
          </Apps_Section>

          <Apps_Section
            icon={<Icon.GoogleTasks />}
            title={t('apps.googleTasks.connections.callsTitle')}
            description={t('apps.googleTasks.connections.callsSummary', { base: GOOGLE_TASKS_API_BASE_PATH })}
          >
            <div className='Gmail_Filters' role='group' aria-label={t('apps.googleTasks.connections.filterLabel')}>
              {FILTERS.map((item) => (
                <button key={item} type='button' className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>
                  {t(`apps.googleTasks.connections.filter.${item}`, { count: callsFor(item).length })}
                </button>
              ))}
            </div>
            <Calls_Table calls={callsFor(filter)} accounts={connectedAccounts} />
          </Apps_Section>
        </div>
      )}
    </div>
  );
};

export default Google_Tasks_Connections;
