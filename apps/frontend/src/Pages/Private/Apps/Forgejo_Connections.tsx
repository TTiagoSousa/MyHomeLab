import './Apps.scss';
import '../Email/Gmail_Connections.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { Apps_Detail_Header, Apps_Section } from './appsShared';
import * as Icon from '../../../Imports/icons';
import {
  FORGEJO_API_BASE_PATH,
  FORGEJO_POSSIBLE_CALLS,
  FORGEJO_SCOPE_GROUPS,
  FORGEJO_USED_CALLS,
  scopeUse,
  type Forgejo_Api_Call,
} from './forgejoApiCalls';

type Call_Filter = 'all' | 'used' | 'possible';

const FILTERS: Call_Filter[] = ['all', 'used', 'possible'];

const CALL_COLUMNS = ['method', 'path', 'description', 'usedBy', 'scope', 'status'] as const;

const callsFor = (filter: Call_Filter) => {
  if (filter === 'used') return FORGEJO_USED_CALLS;
  if (filter === 'possible') return FORGEJO_POSSIBLE_CALLS;
  return [...FORGEJO_USED_CALLS, ...FORGEJO_POSSIBLE_CALLS];
};

const Scopes_Table = () => {
  const { t } = useTranslation('addons');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            <th>{t('apps.forgejo.connections.table.scope')}</th>
            <th>{t('apps.forgejo.connections.table.allows')}</th>
            <th className='center'>{t('apps.forgejo.connections.table.needed')}</th>
          </tr>
        </thead>
        <tbody>
          {FORGEJO_SCOPE_GROUPS.map((group) => {
            const use = scopeUse(group);
            return (
              <tr key={group}>
                <td>
                  <code>{group}</code>
                </td>
                <td>{t(`apps.forgejo.connections.scopes.${group}`)}</td>
                <td className='center'>
                  {use === 'none' ? (
                    <span className='Gmail_Table_Faint'>{t('apps.forgejo.connections.need.none')}</span>
                  ) : (
                    <span className={`Gmail_Table_Status ${use === 'write' ? 'partial' : 'on'}`}>{t(`apps.forgejo.connections.need.${use}`)}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const Calls_Table = ({ calls, isAdmin }: { calls: Forgejo_Api_Call[]; isAdmin: boolean }) => {
  const { t } = useTranslation('addons');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            {CALL_COLUMNS.map((column) => (
              <th key={column}>{t(`apps.forgejo.connections.table.${column}`)}</th>
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
              <td className='Gmail_Table_Description'>{t(`apps.forgejo.connections.calls.${call.id}`)}</td>
              <td>
                {call.usedBy.length ? (
                  <span className='Gmail_Table_Tags'>
                    {call.usedBy.map((consumer) => (
                      <span key={consumer}>{t(`apps.forgejo.connections.usedBy.${consumer}`)}</span>
                    ))}
                  </span>
                ) : (
                  <span className='Gmail_Table_Faint'>{t('apps.forgejo.connections.notUsed')}</span>
                )}
              </td>
              <td>{call.scope ? <code>{call.scope}</code> : <span className='Gmail_Table_Faint'>{t('apps.forgejo.connections.noScope')}</span>}</td>
              <td>
                {call.admin && !isAdmin ? (
                  <span className='Gmail_Table_Status off'>{t('apps.forgejo.connections.needsAdmin')}</span>
                ) : (
                  <span className='Gmail_Table_Status on'>{t(call.admin ? 'apps.forgejo.connections.adminOk' : 'apps.forgejo.connections.available')}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Forgejo_Connections = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const { connectedAccounts, loading } = useConnectedAccounts('FORGEJO');
  const [filter, setFilter] = useState<Call_Filter>('all');

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? account?.username ?? t('apps.forgejo.title');

  return (
    <div className='Apps'>
      <Apps_Detail_Header backTo={`/MyHomeLab/Apps/Forgejo/${accountId}`} backLabel={name} title={t('apps.forgejo.connections.title')} />

      {!account ? (
        <p className='Apps_intro'>{loading ? t('apps.loading') : t('apps.forgejo.notFound')}</p>
      ) : (
        <div className='Apps_list'>
          <Apps_Section
            icon={<Icon.Shield />}
            title={t('apps.forgejo.connections.permissionsTitle')}
            description={t(account.isAdmin ? 'apps.forgejo.connections.permissionsAdmin' : 'apps.forgejo.connections.permissionsNotAdmin')}
          >
            <Scopes_Table />
          </Apps_Section>

          <Apps_Section
            icon={<Icon.Forgejo />}
            title={t('apps.forgejo.connections.callsTitle')}
            description={t('apps.forgejo.connections.callsSummary', { base: `${account.forgejoHost ?? ''}${FORGEJO_API_BASE_PATH}` })}
          >
            <div className='Gmail_Filters' role='group' aria-label={t('apps.forgejo.connections.filterLabel')}>
              {FILTERS.map((item) => (
                <button key={item} type='button' className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>
                  {t(`apps.forgejo.connections.filter.${item}`, { count: callsFor(item).length })}
                </button>
              ))}
            </div>
            <Calls_Table calls={callsFor(filter)} isAdmin={account.isAdmin ?? false} />
          </Apps_Section>
        </div>
      )}
    </div>
  );
};

export default Forgejo_Connections;
