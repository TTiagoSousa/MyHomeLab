import './Apps.scss';
import '../Email/Gmail_Connections.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { Apps_Detail_Header, Apps_Section } from './appsShared';
import * as Icon from '../../../Imports/icons';
import { HOME_ASSISTANT_ACCESS, HOME_ASSISTANT_POSSIBLE_CALLS, HOME_ASSISTANT_USED_CALLS, accessUse, type Home_Assistant_Api_Call } from './homeAssistantApiCalls';

type Call_Filter = 'all' | 'used' | 'possible';

const FILTERS: Call_Filter[] = ['all', 'used', 'possible'];

const CALL_COLUMNS = ['method', 'path', 'description', 'usedBy', 'access', 'status'] as const;

const callsFor = (filter: Call_Filter) => {
  if (filter === 'used') return HOME_ASSISTANT_USED_CALLS;
  if (filter === 'possible') return HOME_ASSISTANT_POSSIBLE_CALLS;
  return [...HOME_ASSISTANT_USED_CALLS, ...HOME_ASSISTANT_POSSIBLE_CALLS];
};

const Access_Table = ({ isAdmin }: { isAdmin: boolean }) => {
  const { t } = useTranslation('addons');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            <th>{t('apps.homeAssistant.connections.table.access')}</th>
            <th>{t('apps.homeAssistant.connections.table.allows')}</th>
            <th className='center'>{t('apps.homeAssistant.connections.table.needed')}</th>
            <th className='center'>{t('apps.homeAssistant.connections.table.account')}</th>
          </tr>
        </thead>
        <tbody>
          {HOME_ASSISTANT_ACCESS.map((access) => {
            const use = accessUse(access);
            const granted = access === 'user' || isAdmin;
            return (
              <tr key={access}>
                <td>{t(`apps.homeAssistant.connections.access.${access}`)}</td>
                <td>{t(`apps.homeAssistant.connections.allows.${access}`)}</td>
                <td className='center'>
                  {use === 'none' ? (
                    <span className='Gmail_Table_Faint'>{t('apps.homeAssistant.connections.need.none')}</span>
                  ) : (
                    <span className={`Gmail_Table_Status ${use === 'write' ? 'partial' : 'on'}`}>{t(`apps.homeAssistant.connections.need.${use}`)}</span>
                  )}
                </td>
                <td className='center'>
                  <span className={`Gmail_Table_Check ${granted ? 'on' : 'off'}`} aria-label={t(granted ? 'apps.homeAssistant.connections.granted' : 'apps.homeAssistant.connections.notGranted')}>
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

const Call_Status = ({ call, isAdmin }: { call: Home_Assistant_Api_Call; isAdmin: boolean }) => {
  const { t } = useTranslation('addons');

  if (call.access !== 'user' && !isAdmin) return <span className='Gmail_Table_Status off'>{t('apps.homeAssistant.connections.needsAdmin')}</span>;
  if (call.access === 'supervisor') return <span className='Gmail_Table_Status partial'>{t('apps.homeAssistant.connections.needsSupervisor')}</span>;
  return <span className='Gmail_Table_Status on'>{t('apps.homeAssistant.connections.available')}</span>;
};

const Calls_Table = ({ calls, isAdmin }: { calls: Home_Assistant_Api_Call[]; isAdmin: boolean }) => {
  const { t } = useTranslation('addons');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            {CALL_COLUMNS.map((column) => (
              <th key={column}>{t(`apps.homeAssistant.connections.table.${column}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calls.map((call) => (
            <tr key={call.id} className={call.usedBy.length ? '' : 'possible'}>
              <td>
                <span className={`Gmail_Table_Method ${call.method === 'WS' ? 'get' : call.method.toLowerCase()}`}>{call.method}</span>
              </td>
              <td>
                <code>{call.path}</code>
              </td>
              <td className='Gmail_Table_Description'>{t(`apps.homeAssistant.connections.calls.${call.id}`)}</td>
              <td>
                {call.usedBy.length ? (
                  <span className='Gmail_Table_Tags'>
                    {call.usedBy.map((consumer) => (
                      <span key={consumer}>{t(`apps.homeAssistant.connections.usedBy.${consumer}`)}</span>
                    ))}
                  </span>
                ) : (
                  <span className='Gmail_Table_Faint'>{t('apps.homeAssistant.connections.notUsed')}</span>
                )}
              </td>
              <td>{t(`apps.homeAssistant.connections.access.${call.access}`)}</td>
              <td>
                <Call_Status call={call} isAdmin={isAdmin} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Home_Assistant_Connections = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const { connectedAccounts, loading } = useConnectedAccounts('HOME_ASSISTANT');
  const [filter, setFilter] = useState<Call_Filter>('all');

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? account?.appHost ?? t('apps.homeAssistant.title');
  const isAdmin = account?.isAdmin ?? false;

  return (
    <div className='Apps'>
      <Apps_Detail_Header backTo={`/MyHomeLab/Apps/HomeAssistant/${accountId}`} backLabel={name} title={t('apps.homeAssistant.connections.title')} />

      {!account ? (
        <p className='Apps_intro'>{loading ? t('apps.loading') : t('apps.homeAssistant.notFound')}</p>
      ) : (
        <div className='Apps_list'>
          <Apps_Section
            icon={<Icon.Shield />}
            title={t('apps.homeAssistant.connections.permissionsTitle')}
            description={t(isAdmin ? 'apps.homeAssistant.connections.permissionsAdmin' : 'apps.homeAssistant.connections.permissionsNotAdmin')}
          >
            <Access_Table isAdmin={isAdmin} />
          </Apps_Section>

          <Apps_Section icon={<Icon.House />} title={t('apps.homeAssistant.connections.callsTitle')} description={t('apps.homeAssistant.connections.callsSummary', { base: account.appHost ?? '' })}>
            <div className='Gmail_Filters' role='group' aria-label={t('apps.homeAssistant.connections.filterLabel')}>
              {FILTERS.map((item) => (
                <button key={item} type='button' className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>
                  {t(`apps.homeAssistant.connections.filter.${item}`, { count: callsFor(item).length })}
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

export default Home_Assistant_Connections;
