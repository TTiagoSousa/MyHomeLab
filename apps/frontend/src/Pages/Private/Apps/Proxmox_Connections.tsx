import './Apps.scss';
import '../Email/Gmail_Connections.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useServers } from '../../../Hooks/Servers/useServers';
import { Apps_Detail_Header, Apps_Section } from './appsShared';
import * as Icon from '../../../Imports/icons';
import {
  PROXMOX_API_BASE_PATH,
  PROXMOX_POSSIBLE_CALLS,
  PROXMOX_PRIVILEGES,
  PROXMOX_USED_CALLS,
  privilegeKey,
  privilegeUsed,
  type Proxmox_Api_Call,
} from './proxmoxApiCalls';

type Call_Filter = 'all' | 'used' | 'possible';

const FILTERS: Call_Filter[] = ['all', 'used', 'possible'];

const CALL_COLUMNS = ['method', 'path', 'description', 'usedBy', 'privilege', 'status'] as const;

const callsFor = (filter: Call_Filter) => {
  if (filter === 'used') return PROXMOX_USED_CALLS;
  if (filter === 'possible') return PROXMOX_POSSIBLE_CALLS;
  return [...PROXMOX_USED_CALLS, ...PROXMOX_POSSIBLE_CALLS];
};

const Privileges_Table = () => {
  const { t } = useTranslation('addons');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            <th>{t('apps.proxmox.connections.table.privilege')}</th>
            <th>{t('apps.proxmox.connections.table.allows')}</th>
            <th className='center'>{t('apps.proxmox.connections.table.needed')}</th>
          </tr>
        </thead>
        <tbody>
          {PROXMOX_PRIVILEGES.map((privilege) => (
            <tr key={privilege}>
              <td>
                <code>{privilege}</code>
              </td>
              <td>{t(`apps.proxmox.connections.privileges.${privilegeKey(privilege)}`)}</td>
              <td className='center'>
                {privilegeUsed(privilege) ? (
                  <span className='Gmail_Table_Status on'>{t('apps.proxmox.connections.used')}</span>
                ) : (
                  <span className='Gmail_Table_Faint'>{t('apps.proxmox.connections.notUsedPrivilege')}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Call_Status = ({ call, sshEnabled }: { call: Proxmox_Api_Call; sshEnabled: boolean }) => {
  const { t } = useTranslation('addons');

  if (call.method !== 'SSH') return <span className='Gmail_Table_Status on'>{t('apps.proxmox.connections.viaToken')}</span>;
  if (sshEnabled) return <span className='Gmail_Table_Status on'>{t('apps.proxmox.connections.sshOn')}</span>;
  return <span className='Gmail_Table_Status off'>{t('apps.proxmox.connections.sshOff')}</span>;
};

const Calls_Table = ({ calls, sshEnabled }: { calls: Proxmox_Api_Call[]; sshEnabled: boolean }) => {
  const { t } = useTranslation('addons');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            {CALL_COLUMNS.map((column) => (
              <th key={column}>{t(`apps.proxmox.connections.table.${column}`)}</th>
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
              <td className='Gmail_Table_Description'>{t(`apps.proxmox.connections.calls.${call.id}`)}</td>
              <td>
                {call.usedBy.length ? (
                  <span className='Gmail_Table_Tags'>
                    {call.usedBy.map((consumer) => (
                      <span key={consumer}>{t(`apps.proxmox.connections.usedBy.${consumer}`)}</span>
                    ))}
                  </span>
                ) : (
                  <span className='Gmail_Table_Faint'>{t('apps.proxmox.connections.notUsed')}</span>
                )}
              </td>
              <td>
                {call.method === 'SSH' ? (
                  <span className='Gmail_Table_Faint'>{t('apps.proxmox.connections.sshKey')}</span>
                ) : call.privileges.length ? (
                  <code>{call.privileges.join(' + ')}</code>
                ) : (
                  <span className='Gmail_Table_Faint'>{t('apps.proxmox.connections.noPrivilege')}</span>
                )}
              </td>
              <td>
                <Call_Status call={call} sshEnabled={sshEnabled} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Proxmox_Connections = () => {
  const { t } = useTranslation('addons');
  const { serverId } = useParams();
  const { servers, loading } = useServers();
  const [filter, setFilter] = useState<Call_Filter>('all');

  const server = servers.find((item) => item.id === serverId);

  return (
    <div className='Apps'>
      <Apps_Detail_Header backTo={`/MyHomeLab/Apps/Proxmox/${serverId}`} backLabel={server?.name ?? 'Proxmox'} title={t('apps.proxmox.connections.title')} />

      {!server ? (
        <p className='Apps_intro'>{loading ? t('apps.loading') : t('apps.proxmox.notFound')}</p>
      ) : (
        <div className='Apps_list'>
          <Apps_Section icon={<Icon.Shield />} title={t('apps.proxmox.connections.permissionsTitle')} description={t('apps.proxmox.connections.permissionsSummary', { token: server.tokenId })}>
            <Privileges_Table />
          </Apps_Section>

          <Apps_Section
            icon={<Icon.Proxmox />}
            title={t('apps.proxmox.connections.callsTitle')}
            description={t(server.sshEnabled ? 'apps.proxmox.connections.callsSummarySsh' : 'apps.proxmox.connections.callsSummaryNoSsh', {
              base: `https://${server.host}:${server.port}${PROXMOX_API_BASE_PATH}`,
            })}
          >
            <div className='Gmail_Filters' role='group' aria-label={t('apps.proxmox.connections.filterLabel')}>
              {FILTERS.map((item) => (
                <button key={item} type='button' className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>
                  {t(`apps.proxmox.connections.filter.${item}`, { count: callsFor(item).length })}
                </button>
              ))}
            </div>
            <Calls_Table calls={callsFor(filter)} sshEnabled={server.sshEnabled} />
          </Apps_Section>
        </div>
      )}
    </div>
  );
};

export default Proxmox_Connections;
