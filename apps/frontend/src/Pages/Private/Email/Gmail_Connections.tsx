import '../Apps/Apps.scss';
import './Gmail_Connections.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConnectedAccounts, type ConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { Apps_Detail_Header, Apps_Section } from '../Apps/appsShared';
import * as Icon from '../../../Imports/icons';
import {
  GMAIL_API_BASE_PATH,
  GMAIL_POSSIBLE_CALLS,
  GMAIL_SCOPES,
  GMAIL_USED_CALLS,
  shortScope,
  type Gmail_Api_Call,
} from './gmailApiCalls';

type Call_Filter = 'all' | 'used' | 'possible';

const FILTERS: Call_Filter[] = ['all', 'used', 'possible'];

const CALL_COLUMNS = ['method', 'path', 'description', 'usedBy', 'scope', 'status'] as const;

const callsFor = (filter: Call_Filter) => {
  if (filter === 'used') return GMAIL_USED_CALLS;
  if (filter === 'possible') return GMAIL_POSSIBLE_CALLS;
  return [...GMAIL_USED_CALLS, ...GMAIL_POSSIBLE_CALLS];
};

const accountName = (account: ConnectedAccount) => account.emailAddress?.split('@')[0] ?? account.id;

const Call_Status = ({ call, accounts }: { call: Gmail_Api_Call; accounts: ConnectedAccount[] }) => {
  const { t } = useTranslation('email');
  const allowed = accounts.filter((account) => call.scopes.some((value) => account.scopes.includes(value))).length;

  if (allowed === accounts.length) return <span className='Gmail_Table_Status on'>{t('connections.allowed')}</span>;
  if (allowed === 0) return <span className='Gmail_Table_Status off'>{t('connections.missing')}</span>;
  return <span className='Gmail_Table_Status partial'>{t('connections.partial', { count: allowed, total: accounts.length })}</span>;
};

const Scopes_Table = ({ accounts }: { accounts: ConnectedAccount[] }) => {
  const { t } = useTranslation('email');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            <th>{t('connections.table.scope')}</th>
            <th>{t('connections.table.allows')}</th>
            {accounts.map((account) => (
              <th key={account.id} className='center' title={account.emailAddress ?? undefined}>
                {accountName(account)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GMAIL_SCOPES.map((item) => (
            <tr key={item.id}>
              <td>
                <code title={item.value}>{shortScope(item.value)}</code>
              </td>
              <td>{t(`connections.scopes.${item.id}`)}</td>
              {accounts.map((account) => {
                const granted = account.scopes.includes(item.value);
                const includedIn = granted ? undefined : item.includedIn.find((value) => account.scopes.includes(value));
                return (
                  <td key={account.id} className='center'>
                    {includedIn ? (
                      <span className='Gmail_Table_Faint'>{t('connections.includedIn', { scope: shortScope(includedIn) })}</span>
                    ) : (
                      <span className={`Gmail_Table_Check ${granted ? 'on' : 'off'}`} aria-label={t(granted ? 'connections.granted' : 'connections.notGranted')}>
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

const Calls_Table = ({ calls, accounts }: { calls: Gmail_Api_Call[]; accounts: ConnectedAccount[] }) => {
  const { t } = useTranslation('email');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            {CALL_COLUMNS.map((column) => (
              <th key={column}>{t(`connections.table.${column}`)}</th>
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
              <td className='Gmail_Table_Description'>{t(`connections.calls.${call.id}`)}</td>
              <td>
                {call.usedBy.length ? (
                  <span className='Gmail_Table_Tags'>
                    {call.usedBy.map((consumer) => (
                      <span key={consumer}>{t(`connections.usedBy.${consumer}`)}</span>
                    ))}
                  </span>
                ) : (
                  <span className='Gmail_Table_Faint'>{t('connections.notUsed')}</span>
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

const Gmail_Connections = () => {
  const { t } = useTranslation('email');
  const { connectedAccounts, loading } = useConnectedAccounts('GMAIL');
  const [filter, setFilter] = useState<Call_Filter>('all');

  return (
    <div className='Apps'>
      <Apps_Detail_Header backTo='/MyHomeLab/Apps/Gmail' backLabel={t('page.title')} title={t('page.connections')} />

      {!connectedAccounts.length ? (
        <p className='Apps_intro'>{loading ? t('account.loading') : t('connections.noAccounts')}</p>
      ) : (
        <div className='Apps_list'>
          <Apps_Section icon={<Icon.Shield />} title={t('connections.permissionsTitle')} description={t('connections.permissionsSummary')}>
            <Scopes_Table accounts={connectedAccounts} />
          </Apps_Section>

          <Apps_Section icon={<Icon.Mail />} title={t('connections.callsTitle')} description={t('connections.callsSummary', { base: GMAIL_API_BASE_PATH })}>
            <div className='Gmail_Filters' role='group' aria-label={t('connections.filterLabel')}>
              {FILTERS.map((item) => (
                <button
                  key={item}
                  type='button'
                  className={filter === item ? 'active' : ''}
                  aria-pressed={filter === item}
                  onClick={() => setFilter(item)}
                >
                  {t(`connections.filter.${item}`, { count: callsFor(item).length })}
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

export default Gmail_Connections;
