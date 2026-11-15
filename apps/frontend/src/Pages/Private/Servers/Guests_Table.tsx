import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DashboardGuest } from '../../../Hooks/Servers/useServerDashboard';
import { formatBytes, formatPercent, formatUptime, ratio, usageLevel } from './format';
import * as Icon from '../../../Imports/icons';

type Column = 'vmid' | 'name' | 'status' | 'cpu' | 'memory' | 'disk' | 'uptime';
type Filter = 'all' | 'running' | 'stopped';

const COLUMNS: Column[] = ['vmid', 'name', 'status', 'cpu', 'memory', 'disk', 'uptime'];
const FILTERS: Filter[] = ['all', 'running', 'stopped'];

const sortValue: Record<Column, (guest: DashboardGuest) => number | string> = {
  vmid: (guest) => guest.vmid,
  name: (guest) => guest.name.toLowerCase(),
  status: (guest) => guest.status,
  cpu: (guest) => guest.cpu,
  memory: (guest) => guest.memUsed,
  disk: (guest) => guest.diskUsed,
  uptime: (guest) => guest.uptime,
};

const isRunning = (guest: DashboardGuest) => guest.status === 'running';

interface Guests_Table_Props {
  guests: DashboardGuest[];
}

const Guests_Table = ({ guests }: Guests_Table_Props) => {
  const { t } = useTranslation('servers');
  const [sortColumn, setSortColumn] = useState<Column>('vmid');
  const [sortDesc, setSortDesc] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState(false);

  const handleSort = (column: Column) => {
    if (column === sortColumn) {
      setSortDesc(!sortDesc);
    } else {
      setSortColumn(column);
      setSortDesc(column !== 'vmid' && column !== 'name');
    }
  };

  const filtered = guests.filter((guest) => {
    if (filter === 'running') return isRunning(guest);
    if (filter === 'stopped') return !isRunning(guest);
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const valueA = sortValue[sortColumn](a);
    const valueB = sortValue[sortColumn](b);
    const order = valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
    return sortDesc ? -order : order;
  });

  return (
    <section className={`Servers_card Servers_collapsible${expanded ? ' expanded' : ''}`}>
      <button type='button' className='Servers_collapse_toggle' onClick={() => setExpanded(!expanded)}>
        <span className='Servers_collapse_chevron'>
          <Icon.Chevron />
        </span>
        <span className='Servers_card_label'>{t('guests.title', { count: guests.length })}</span>
      </button>

      <div className='Servers_collapse_body'>
        <div className='Servers_collapse_inner'>
          <div className='Servers_segmented'>
            {FILTERS.map((key) => (
              <button key={key} type='button' className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>
                {t(`guests.filter.${key}`)}
              </button>
            ))}
          </div>

          <div className='Servers_table_wrap'>
            <table className='Servers_table'>
              <thead>
                <tr>
                  {COLUMNS.map((column) => (
                    <th
                      key={column}
                      className={column === sortColumn ? `sorted ${sortDesc ? 'desc' : 'asc'}` : ''}
                      onClick={() => handleSort(column)}
                    >
                      {t(`guests.col.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((guest) => {
                  const running = isRunning(guest);
                  const memoryFraction = ratio(guest.memUsed, guest.memTotal);

                  return (
                    <tr key={`${guest.node}-${guest.vmid}`} className={running ? '' : 'stopped'}>
                      <td className='mono'>{guest.vmid}</td>
                      <td>
                        <span className='Servers_guest_name'>{guest.name}</span>
                        <span className='Servers_tag'>{guest.type === 'qemu' ? 'VM' : 'LXC'}</span>
                      </td>
                      <td>
                        <i className={`Servers_dot ${running ? 'on' : 'off'}`} />
                        {t(`guests.status.${running ? 'running' : 'stopped'}`)}
                      </td>
                      <td className='mono'>{running ? formatPercent(guest.cpu, 1) : '—'}</td>
                      <td>
                        {running ? (
                          <span className='Servers_inline_meter'>
                            <span className='Servers_meter_track small'>
                              <i className={usageLevel(memoryFraction)} style={{ width: `${Math.min(memoryFraction, 1) * 100}%` }} />
                            </span>
                            <span className='mono'>{formatBytes(guest.memUsed)} / {formatBytes(guest.memTotal, 0)}</span>
                          </span>
                        ) : (
                          <span className='mono'>{formatBytes(guest.memTotal, 0)}</span>
                        )}
                      </td>
                      <td className='mono'>
                        {guest.diskUsed > 0 && `${formatBytes(guest.diskUsed)} / `}
                        {formatBytes(guest.diskTotal, 0)}
                      </td>
                      <td className='mono'>{running ? formatUptime(guest.uptime) : '—'}</td>
                    </tr>
                  );
                })}

                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length} className='Servers_table_empty'>
                      {t('guests.none')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Guests_Table;
