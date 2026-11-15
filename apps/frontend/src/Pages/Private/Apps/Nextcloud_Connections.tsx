import './Apps.scss';
import '../Email/Gmail_Connections.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { Apps_Detail_Header, Apps_Section } from './appsShared';
import * as Icon from '../../../Imports/icons';
import { NEXTCLOUD_ACCESS, NEXTCLOUD_POSSIBLE_CALLS, NEXTCLOUD_USED_CALLS, accessUse, type Nextcloud_Api_Call } from './nextcloudApiCalls';

type Call_Filter = 'all' | 'used' | 'possible';

const FILTERS: Call_Filter[] = ['all', 'used', 'possible'];

const CALL_COLUMNS = ['method', 'path', 'description', 'usedBy', 'access', 'status'] as const;

const callsFor = (filter: Call_Filter) => {
  if (filter === 'used') return NEXTCLOUD_USED_CALLS;
  if (filter === 'possible') return NEXTCLOUD_POSSIBLE_CALLS;
  return [...NEXTCLOUD_USED_CALLS, ...NEXTCLOUD_POSSIBLE_CALLS];
};

const Access_Table = ({ isAdmin }: { isAdmin: boolean }) => {
  const { t } = useTranslation('addons');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            <th>{t('apps.nextcloud.connections.table.access')}</th>
            <th>{t('apps.nextcloud.connections.table.allows')}</th>
            <th className='center'>{t('apps.nextcloud.connections.table.needed')}</th>
            <th className='center'>{t('apps.nextcloud.connections.table.account')}</th>
          </tr>
        </thead>
        <tbody>
          {NEXTCLOUD_ACCESS.map((access) => {
            const use = accessUse(access);
            const granted = access !== 'admin' || isAdmin;
            return (
              <tr key={access}>
                <td>{t(`apps.nextcloud.connections.access.${access}`)}</td>
                <td>{t(`apps.nextcloud.connections.allows.${access}`)}</td>
                <td className='center'>
                  {use === 'none' ? (
                    <span className='Gmail_Table_Faint'>{t('apps.nextcloud.connections.need.none')}</span>
                  ) : (
                    <span className={`Gmail_Table_Status ${use === 'write' ? 'partial' : 'on'}`}>{t(`apps.nextcloud.connections.need.${use}`)}</span>
                  )}
                </td>
                <td className='center'>
                  <span className={`Gmail_Table_Check ${granted ? 'on' : 'off'}`} aria-label={t(granted ? 'apps.nextcloud.connections.granted' : 'apps.nextcloud.connections.notGranted')}>
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

const Calls_Table = ({ calls, isAdmin }: { calls: Nextcloud_Api_Call[]; isAdmin: boolean }) => {
  const { t } = useTranslation('addons');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            {CALL_COLUMNS.map((column) => (
              <th key={column}>{t(`apps.nextcloud.connections.table.${column}`)}</th>
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
              <td className='Gmail_Table_Description'>{t(`apps.nextcloud.connections.calls.${call.id}`)}</td>
              <td>
                {call.usedBy.length ? (
                  <span className='Gmail_Table_Tags'>
                    {call.usedBy.map((consumer) => (
                      <span key={consumer}>{t(`apps.nextcloud.connections.usedBy.${consumer}`)}</span>
                    ))}
                  </span>
                ) : (
                  <span className='Gmail_Table_Faint'>{t('apps.nextcloud.connections.notUsed')}</span>
                )}
              </td>
              <td>{t(`apps.nextcloud.connections.access.${call.access}`)}</td>
              <td>
                {call.access === 'admin' && !isAdmin ? (
                  <span className='Gmail_Table_Status off'>{t('apps.nextcloud.connections.needsAdmin')}</span>
                ) : (
                  <span className='Gmail_Table_Status on'>{t('apps.nextcloud.connections.available')}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Nextcloud_Connections = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const { connectedAccounts, loading } = useConnectedAccounts('NEXTCLOUD');
  const [filter, setFilter] = useState<Call_Filter>('all');

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? account?.caldavUsername ?? t('apps.nextcloud.title');
  const host = account?.appHost ?? account?.caldavHost ?? '';
  const isAdmin = account?.isAdmin ?? false;

  return (
    <div className='Apps'>
      <Apps_Detail_Header backTo={`/MyHomeLab/Apps/Nextcloud/${accountId}`} backLabel={name} title={t('apps.nextcloud.connections.title')} />

      {!account ? (
        <p className='Apps_intro'>{loading ? t('apps.loading') : t('apps.nextcloud.notFound')}</p>
      ) : (
        <div className='Apps_list'>
          <Apps_Section
            icon={<Icon.Shield />}
            title={t('apps.nextcloud.connections.permissionsTitle')}
            description={t(isAdmin ? 'apps.nextcloud.connections.permissionsAdmin' : 'apps.nextcloud.connections.permissionsNotAdmin')}
          >
            <Access_Table isAdmin={isAdmin} />
          </Apps_Section>

          <Apps_Section icon={<Icon.Nextcloud />} title={t('apps.nextcloud.connections.callsTitle')} description={t('apps.nextcloud.connections.callsSummary', { base: host })}>
            <div className='Gmail_Filters' role='group' aria-label={t('apps.nextcloud.connections.filterLabel')}>
              {FILTERS.map((item) => (
                <button key={item} type='button' className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>
                  {t(`apps.nextcloud.connections.filter.${item}`, { count: callsFor(item).length })}
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

export default Nextcloud_Connections;
