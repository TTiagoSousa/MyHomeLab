import './Apps.scss';
import '../Email/Gmail_Connections.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { Apps_Detail_Header, Apps_Section } from './appsShared';
import * as Icon from '../../../Imports/icons';
import { SOLIDTIME_ACCESS, SOLIDTIME_POSSIBLE_CALLS, SOLIDTIME_USED_CALLS, accessUse, type Solidtime_Api_Call } from './solidtimeApiCalls';

type Call_Filter = 'all' | 'used' | 'possible';

const FILTERS: Call_Filter[] = ['all', 'used', 'possible'];

const CALL_COLUMNS = ['method', 'path', 'description', 'usedBy', 'access', 'status'] as const;

const callsFor = (filter: Call_Filter) => {
  if (filter === 'used') return SOLIDTIME_USED_CALLS;
  if (filter === 'possible') return SOLIDTIME_POSSIBLE_CALLS;
  return [...SOLIDTIME_USED_CALLS, ...SOLIDTIME_POSSIBLE_CALLS];
};

const Access_Table = ({ isAdmin }: { isAdmin: boolean }) => {
  const { t } = useTranslation('addons');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            <th>{t('apps.solidtime.connections.table.access')}</th>
            <th>{t('apps.solidtime.connections.table.allows')}</th>
            <th className='center'>{t('apps.solidtime.connections.table.needed')}</th>
            <th className='center'>{t('apps.solidtime.connections.table.account')}</th>
          </tr>
        </thead>
        <tbody>
          {SOLIDTIME_ACCESS.map((access) => {
            const use = accessUse(access);
            const granted = access !== 'admin' || isAdmin;
            return (
              <tr key={access}>
                <td>{t(`apps.solidtime.connections.access.${access}`)}</td>
                <td>{t(`apps.solidtime.connections.allows.${access}`)}</td>
                <td className='center'>
                  {use === 'none' ? (
                    <span className='Gmail_Table_Faint'>{t('apps.solidtime.connections.need.none')}</span>
                  ) : (
                    <span className={`Gmail_Table_Status ${use === 'write' ? 'partial' : 'on'}`}>{t(`apps.solidtime.connections.need.${use}`)}</span>
                  )}
                </td>
                <td className='center'>
                  <span className={`Gmail_Table_Check ${granted ? 'on' : 'off'}`} aria-label={t(granted ? 'apps.solidtime.connections.granted' : 'apps.solidtime.connections.notGranted')}>
                    {granted ? '✓' : '—'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const Calls_Table = ({ calls, isAdmin }: { calls: Solidtime_Api_Call[]; isAdmin: boolean }) => {
  const { t } = useTranslation('addons');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            {CALL_COLUMNS.map((column) => (
              <th key={column}>{t(`apps.solidtime.connections.table.${column}`)}</th>
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
              <td className='Gmail_Table_Description'>{t(`apps.solidtime.connections.calls.${call.id}`)}</td>
              <td>
                {call.usedBy.length ? (
                  <span className='Gmail_Table_Tags'>
                    {call.usedBy.map((consumer) => (
                      <span key={consumer}>{t(`apps.solidtime.connections.usedBy.${consumer}`)}</span>
                    ))}
                  </span>
                ) : (
                  <span className='Gmail_Table_Faint'>{t('apps.solidtime.connections.notUsed')}</span>
                )}
              </td>
              <td>{t(`apps.solidtime.connections.access.${call.access}`)}</td>
              <td>
                {call.access === 'admin' && !isAdmin ? (
                  <span className='Gmail_Table_Status off'>{t('apps.solidtime.connections.needsAdmin')}</span>
                ) : (
                  <span className='Gmail_Table_Status on'>{t('apps.solidtime.connections.available')}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Solidtime_Connections = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const { connectedAccounts, loading } = useConnectedAccounts('SOLIDTIME');
  const [filter, setFilter] = useState<Call_Filter>('all');

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? t('apps.solidtime.title');
  const isAdmin = account?.isAdmin ?? false;

  return (
    <div className='Apps'>
      <Apps_Detail_Header backTo={`/MyHomeLab/Apps/Solidtime/${accountId}`} backLabel={name} title={t('apps.solidtime.connections.title')} />

      {!account ? (
        <p className='Apps_intro'>{loading ? t('apps.loading') : t('apps.solidtime.notFound')}</p>
      ) : (
        <div className='Apps_list'>
          <Apps_Section
            icon={<Icon.Shield />}
            title={t('apps.solidtime.connections.permissionsTitle')}
            description={t(isAdmin ? 'apps.solidtime.connections.permissionsAdmin' : 'apps.solidtime.connections.permissionsNotAdmin')}
          >
            <Access_Table isAdmin={isAdmin} />
          </Apps_Section>

          <Apps_Section icon={<Icon.Solidtime />} title={t('apps.solidtime.connections.callsTitle')} description={t('apps.solidtime.connections.callsSummary', { base: account.appHost ?? '' })}>
            <div className='Gmail_Filters' role='group' aria-label={t('apps.solidtime.connections.filterLabel')}>
              {FILTERS.map((item) => (
                <button key={item} type='button' className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>
                  {t(`apps.solidtime.connections.filter.${item}`, { count: callsFor(item).length })}
                </button>
              ))}
            </div>
            <Calls_Table calls={callsFor(filter)} isAdmin={isAdmin} />
          </Apps_Section>
        </div>
      )}
    </div>
  );
};

export default Solidtime_Connections;
