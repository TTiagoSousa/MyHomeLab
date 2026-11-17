import './Apps.scss';
import '../Email/Gmail_Connections.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { Apps_Detail_Header, Apps_Section } from './appsShared';
import * as Icon from '../../../Imports/icons';
import { GAMETRACKER_ACCESS, GAMETRACKER_POSSIBLE_CALLS, GAMETRACKER_USED_CALLS, accessUse, type GameTracker_Api_Call } from './gameTrackerApiCalls';

type Call_Filter = 'all' | 'used' | 'possible';

const FILTERS: Call_Filter[] = ['all', 'used', 'possible'];

const CALL_COLUMNS = ['method', 'path', 'description', 'usedBy', 'access', 'status'] as const;

const callsFor = (filter: Call_Filter) => {
  if (filter === 'used') return GAMETRACKER_USED_CALLS;
  if (filter === 'possible') return GAMETRACKER_POSSIBLE_CALLS;
  return [...GAMETRACKER_USED_CALLS, ...GAMETRACKER_POSSIBLE_CALLS];
};

const Access_Table = ({ isAdmin }: { isAdmin: boolean }) => {
  const { t } = useTranslation('addons');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            <th>{t('apps.gameTracker.connections.table.access')}</th>
            <th>{t('apps.gameTracker.connections.table.allows')}</th>
            <th className='center'>{t('apps.gameTracker.connections.table.needed')}</th>
            <th className='center'>{t('apps.gameTracker.connections.table.account')}</th>
          </tr>
        </thead>
        <tbody>
          {GAMETRACKER_ACCESS.map((access) => {
            const use = accessUse(access);
            const granted = access !== 'admin' || isAdmin;
            return (
              <tr key={access}>
                <td>{t(`apps.gameTracker.connections.access.${access}`)}</td>
                <td>{t(`apps.gameTracker.connections.allows.${access}`)}</td>
                <td className='center'>
                  {use === 'none' ? (
                    <span className='Gmail_Table_Faint'>{t('apps.gameTracker.connections.need.none')}</span>
                  ) : (
                    <span className={`Gmail_Table_Status ${use === 'write' ? 'partial' : 'on'}`}>{t(`apps.gameTracker.connections.need.${use}`)}</span>
                  )}
                </td>
                <td className='center'>
                  <span className={`Gmail_Table_Check ${granted ? 'on' : 'off'}`} aria-label={t(granted ? 'apps.gameTracker.connections.granted' : 'apps.gameTracker.connections.notGranted')}>
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

const Calls_Table = ({ calls, isAdmin }: { calls: GameTracker_Api_Call[]; isAdmin: boolean }) => {
  const { t } = useTranslation('addons');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            {CALL_COLUMNS.map((column) => (
              <th key={column}>{t(`apps.gameTracker.connections.table.${column}`)}</th>
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
              <td className='Gmail_Table_Description'>{t(`apps.gameTracker.connections.calls.${call.id}`)}</td>
              <td>
                {call.usedBy.length ? (
                  <span className='Gmail_Table_Tags'>
                    {call.usedBy.map((consumer) => (
                      <span key={consumer}>{t(`apps.gameTracker.connections.usedBy.${consumer}`)}</span>
                    ))}
                  </span>
                ) : (
                  <span className='Gmail_Table_Faint'>{t('apps.gameTracker.connections.notUsed')}</span>
                )}
              </td>
              <td>{t(`apps.gameTracker.connections.access.${call.access}`)}</td>
              <td>
                {call.access === 'admin' && !isAdmin ? (
                  <span className='Gmail_Table_Status off'>{t('apps.gameTracker.connections.needsAdmin')}</span>
                ) : (
                  <span className='Gmail_Table_Status on'>{t('apps.gameTracker.connections.available')}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const GameTracker_Connections = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const { connectedAccounts, loading } = useConnectedAccounts('GAMETRACKER');
  const [filter, setFilter] = useState<Call_Filter>('all');

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? t('apps.gameTracker.title');
  const isAdmin = account?.isAdmin ?? false;

  return (
    <div className='Apps'>
      <Apps_Detail_Header backTo={`/MyHomeLab/Apps/GameTracker/${accountId}`} backLabel={name} title={t('apps.gameTracker.connections.title')} />

      {!account ? (
        <p className='Apps_intro'>{loading ? t('apps.loading') : t('apps.gameTracker.notFound')}</p>
      ) : (
        <div className='Apps_list'>
          <Apps_Section
            icon={<Icon.Shield />}
            title={t('apps.gameTracker.connections.permissionsTitle')}
            description={t(isAdmin ? 'apps.gameTracker.connections.permissionsAdmin' : 'apps.gameTracker.connections.permissionsNotAdmin')}
          >
            <Access_Table isAdmin={isAdmin} />
          </Apps_Section>

          <Apps_Section icon={<Icon.GameTracker />} title={t('apps.gameTracker.connections.callsTitle')} description={t('apps.gameTracker.connections.callsSummary', { base: account.appHost ?? '' })}>
            <div className='Gmail_Filters' role='group' aria-label={t('apps.gameTracker.connections.filterLabel')}>
              {FILTERS.map((item) => (
                <button key={item} type='button' className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>
                  {t(`apps.gameTracker.connections.filter.${item}`, { count: callsFor(item).length })}
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

export default GameTracker_Connections;
