import './Apps.scss';
import '../Email/Gmail_Connections.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { Apps_Detail_Header, Apps_Section } from './appsShared';
import * as Icon from '../../../Imports/icons';
import { OPENGYM_ACCESS, OPENGYM_POSSIBLE_CALLS, OPENGYM_USED_CALLS, accessUse, type OpenGym_Api_Call } from './openGymApiCalls';

type Call_Filter = 'all' | 'used' | 'possible';

const FILTERS: Call_Filter[] = ['all', 'used', 'possible'];

const CALL_COLUMNS = ['method', 'path', 'description', 'usedBy', 'access', 'status'] as const;

const callsFor = (filter: Call_Filter) => {
  if (filter === 'used') return OPENGYM_USED_CALLS;
  if (filter === 'possible') return OPENGYM_POSSIBLE_CALLS;
  return [...OPENGYM_USED_CALLS, ...OPENGYM_POSSIBLE_CALLS];
};

const Access_Table = ({ isAdmin }: { isAdmin: boolean }) => {
  const { t } = useTranslation('addons');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            <th>{t('apps.openGym.connections.table.access')}</th>
            <th>{t('apps.openGym.connections.table.allows')}</th>
            <th className='center'>{t('apps.openGym.connections.table.needed')}</th>
            <th className='center'>{t('apps.openGym.connections.table.account')}</th>
          </tr>
        </thead>
        <tbody>
          {OPENGYM_ACCESS.map((access) => {
            const use = accessUse(access);
            const granted = access !== 'admin' || isAdmin;
            return (
              <tr key={access}>
                <td>{t(`apps.openGym.connections.access.${access}`)}</td>
                <td>{t(`apps.openGym.connections.allows.${access}`)}</td>
                <td className='center'>
                  {use === 'none' ? (
                    <span className='Gmail_Table_Faint'>{t('apps.openGym.connections.need.none')}</span>
                  ) : (
                    <span className={`Gmail_Table_Status ${use === 'write' ? 'partial' : 'on'}`}>{t(`apps.openGym.connections.need.${use}`)}</span>
                  )}
                </td>
                <td className='center'>
                  <span className={`Gmail_Table_Check ${granted ? 'on' : 'off'}`} aria-label={t(granted ? 'apps.openGym.connections.granted' : 'apps.openGym.connections.notGranted')}>
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

const Calls_Table = ({ calls, isAdmin }: { calls: OpenGym_Api_Call[]; isAdmin: boolean }) => {
  const { t } = useTranslation('addons');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            {CALL_COLUMNS.map((column) => (
              <th key={column}>{t(`apps.openGym.connections.table.${column}`)}</th>
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
              <td className='Gmail_Table_Description'>{t(`apps.openGym.connections.calls.${call.id}`)}</td>
              <td>
                {call.usedBy.length ? (
                  <span className='Gmail_Table_Tags'>
                    {call.usedBy.map((consumer) => (
                      <span key={consumer}>{t(`apps.openGym.connections.usedBy.${consumer}`)}</span>
                    ))}
                  </span>
                ) : (
                  <span className='Gmail_Table_Faint'>{t('apps.openGym.connections.notUsed')}</span>
                )}
              </td>
              <td>{t(`apps.openGym.connections.access.${call.access}`)}</td>
              <td>
                {call.access === 'admin' && !isAdmin ? (
                  <span className='Gmail_Table_Status off'>{t('apps.openGym.connections.needsAdmin')}</span>
                ) : (
                  <span className='Gmail_Table_Status on'>{t('apps.openGym.connections.available')}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const OpenGym_Connections = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const { connectedAccounts, loading } = useConnectedAccounts('OPENGYM');
  const [filter, setFilter] = useState<Call_Filter>('all');

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? t('apps.openGym.title');
  const isAdmin = account?.isAdmin ?? false;

  return (
    <div className='Apps'>
      <Apps_Detail_Header backTo={`/MyHomeLab/Apps/OpenGym/${accountId}`} backLabel={name} title={t('apps.openGym.connections.title')} />

      {!account ? (
        <p className='Apps_intro'>{loading ? t('apps.loading') : t('apps.openGym.notFound')}</p>
      ) : (
        <div className='Apps_list'>
          <Apps_Section
            icon={<Icon.Shield />}
            title={t('apps.openGym.connections.permissionsTitle')}
            description={t(isAdmin ? 'apps.openGym.connections.permissionsAdmin' : 'apps.openGym.connections.permissionsNotAdmin')}
          >
            <Access_Table isAdmin={isAdmin} />
          </Apps_Section>

          <Apps_Section icon={<Icon.OpenGym />} title={t('apps.openGym.connections.callsTitle')} description={t('apps.openGym.connections.callsSummary', { base: account.appHost ?? '' })}>
            <div className='Gmail_Filters' role='group' aria-label={t('apps.openGym.connections.filterLabel')}>
              {FILTERS.map((item) => (
                <button key={item} type='button' className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>
                  {t(`apps.openGym.connections.filter.${item}`, { count: callsFor(item).length })}
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

export default OpenGym_Connections;
