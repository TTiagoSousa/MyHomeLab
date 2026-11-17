import './Apps.scss';
import '../Email/Gmail_Connections.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { Apps_Detail_Header, Apps_Section } from './appsShared';
import * as Icon from '../../../Imports/icons';
import { PAPERLESS_ACCESS, PAPERLESS_POSSIBLE_CALLS, PAPERLESS_USED_CALLS, accessUse, userAllows, type Paperless_Api_Call } from './paperlessApiCalls';
import { usePaperlessStatus } from '../../../Hooks/ConnectedAccount/usePaperlessStatus';

type Call_Filter = 'all' | 'used' | 'possible';

const FILTERS: Call_Filter[] = ['all', 'used', 'possible'];

const CALL_COLUMNS = ['method', 'path', 'description', 'usedBy', 'access', 'permission', 'status'] as const;

const callsFor = (filter: Call_Filter) => {
  if (filter === 'used') return PAPERLESS_USED_CALLS;
  if (filter === 'possible') return PAPERLESS_POSSIBLE_CALLS;
  return [...PAPERLESS_USED_CALLS, ...PAPERLESS_POSSIBLE_CALLS];
};

const Access_Table = ({ isAdmin }: { isAdmin: boolean }) => {
  const { t } = useTranslation('addons');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            <th>{t('apps.paperless.connections.table.access')}</th>
            <th>{t('apps.paperless.connections.table.allows')}</th>
            <th className='center'>{t('apps.paperless.connections.table.needed')}</th>
            <th className='center'>{t('apps.paperless.connections.table.account')}</th>
          </tr>
        </thead>
        <tbody>
          {PAPERLESS_ACCESS.map((access) => {
            const use = accessUse(access);
            const granted = access !== 'admin' || isAdmin;
            return (
              <tr key={access}>
                <td>{t(`apps.paperless.connections.access.${access}`)}</td>
                <td>{t(`apps.paperless.connections.allows.${access}`)}</td>
                <td className='center'>
                  {use === 'none' ? (
                    <span className='Gmail_Table_Faint'>{t('apps.paperless.connections.need.none')}</span>
                  ) : (
                    <span className={`Gmail_Table_Status ${use === 'write' ? 'partial' : 'on'}`}>{t(`apps.paperless.connections.need.${use}`)}</span>
                  )}
                </td>
                <td className='center'>
                  <span className={`Gmail_Table_Check ${granted ? 'on' : 'off'}`} aria-label={t(granted ? 'apps.paperless.connections.granted' : 'apps.paperless.connections.notGranted')}>
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

const Calls_Table = ({ calls, isAdmin, permissions }: { calls: Paperless_Api_Call[]; isAdmin: boolean; permissions: string[] | null }) => {
  const { t } = useTranslation('addons');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            {CALL_COLUMNS.map((column) => (
              <th key={column}>{t(`apps.paperless.connections.table.${column}`)}</th>
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
              <td className='Gmail_Table_Description'>{t(`apps.paperless.connections.calls.${call.id}`)}</td>
              <td>
                {call.usedBy.length ? (
                  <span className='Gmail_Table_Tags'>
                    {call.usedBy.map((consumer) => (
                      <span key={consumer}>{t(`apps.paperless.connections.usedBy.${consumer}`)}</span>
                    ))}
                  </span>
                ) : (
                  <span className='Gmail_Table_Faint'>{t('apps.paperless.connections.notUsed')}</span>
                )}
              </td>
              <td>{t(`apps.paperless.connections.access.${call.access}`)}</td>
              <td>{call.permission ? <code>{call.permission}</code> : <span className='Gmail_Table_Faint'>—</span>}</td>
              <td>
                {call.access === 'admin' && !isAdmin ? (
                  <span className='Gmail_Table_Status off'>{t('apps.paperless.connections.needsAdmin')}</span>
                ) : !userAllows(permissions, isAdmin, call.permission) ? (
                  <span className='Gmail_Table_Status off'>{t('apps.paperless.connections.missingPermission')}</span>
                ) : (
                  <span className='Gmail_Table_Status on'>{t('apps.paperless.connections.available')}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Paperless_Connections = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const { connectedAccounts, loading } = useConnectedAccounts('PAPERLESS');
  const [filter, setFilter] = useState<Call_Filter>('all');

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? t('apps.paperless.title');
  const { status } = usePaperlessStatus(accountId);
  const isAdmin = status?.isAdmin ?? account?.isAdmin ?? false;
  const permissions = status?.permissions ?? null;

  return (
    <div className='Apps'>
      <Apps_Detail_Header backTo={`/MyHomeLab/Apps/Paperless/${accountId}`} backLabel={name} title={t('apps.paperless.connections.title')} />

      {!account ? (
        <p className='Apps_intro'>{loading ? t('apps.loading') : t('apps.paperless.notFound')}</p>
      ) : (
        <div className='Apps_list'>
          <Apps_Section
            icon={<Icon.Shield />}
            title={t('apps.paperless.connections.permissionsTitle')}
            description={t(isAdmin ? 'apps.paperless.connections.permissionsAdmin' : 'apps.paperless.connections.permissionsNotAdmin')}
          >
            <Access_Table isAdmin={isAdmin} />
            <p className='Apps_section_note'>
              {permissions === null
                ? t('apps.paperless.connections.keyUnknown')
                : isAdmin
                  ? t('apps.paperless.connections.keyAll')
                  : t('apps.paperless.connections.keySome', { count: permissions.length, permissions: permissions.join(', ') })}
            </p>
          </Apps_Section>

          <Apps_Section icon={<Icon.Paperless />} title={t('apps.paperless.connections.callsTitle')} description={t('apps.paperless.connections.callsSummary', { base: account.appHost ?? '' })}>
            <div className='Gmail_Filters' role='group' aria-label={t('apps.paperless.connections.filterLabel')}>
              {FILTERS.map((item) => (
                <button key={item} type='button' className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>
                  {t(`apps.paperless.connections.filter.${item}`, { count: callsFor(item).length })}
                </button>
              ))}
            </div>
            <Calls_Table calls={callsFor(filter)} isAdmin={isAdmin} permissions={permissions} />
          </Apps_Section>
        </div>
      )}
    </div>
  );
};

export default Paperless_Connections;
