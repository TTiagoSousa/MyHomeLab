import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServerDisks, type DiskStatus } from '../../../Hooks/Servers/useServerDisks';
import * as Icon from '../../../Imports/icons';
import { formatBytes, formatPercent, ratio } from './format';
import Disk_Row from './Disk_Row';
import './Disks_Table.scss';

const COLUMNS = ['disk', 'health', 'life', 'temperature', 'reallocated', 'pending', 'hours', 'history'];

const worstStatus = (statuses: DiskStatus[]): DiskStatus => {
  if (statuses.includes('problem')) return 'problem';
  if (statuses.includes('warning')) return 'warning';
  return 'ok';
};

interface Disks_Table_Props {
  serverId: string;
  node: string;
}

const Disks_Table = ({ serverId, node }: Disks_Table_Props) => {
  const { t } = useTranslation('servers');
  const { overview, loading, error, fetchDisks } = useServerDisks(serverId);
  const [expanded, setExpanded] = useState(false);

  const nodeDisks = overview?.nodes.find((entry) => entry.node === node) ?? null;
  const disks = nodeDisks?.disks ?? [];
  const pools = nodeDisks?.pools ?? [];
  const statuses = [...disks, ...pools].map((item) => item.status);
  const attention = statuses.filter((status) => status === 'problem' || status === 'warning').length;
  const overall = worstStatus(statuses);

  const renderSummary = () => {
    if (loading && !overview) return <span className='Disks_summary'>{t('disks.loading')}</span>;
    if (error || nodeDisks?.error) return <span className='Disks_summary problem'>{t('disks.unreadable')}</span>;
    if (!overview) return null;
    if (attention > 0) return <span className={`Disks_summary ${overall}`}>{t('disks.attention', { count: attention })}</span>;
    return <span className='Disks_summary ok'>{t('disks.healthy')}</span>;
  };

  return (
    <section className={`Servers_card Servers_collapsible${expanded ? ' expanded' : ''}`}>
      <div className='Servers_monitors_head'>
        <button type='button' className='Servers_collapse_toggle' onClick={() => setExpanded(!expanded)}>
          <span className='Servers_collapse_chevron'>
            <Icon.Chevron />
          </span>
          <span className='Servers_card_label'>{t('disks.title', { count: disks.length })}</span>
          {renderSummary()}
        </button>

        <button type='button' className='Servers_monitors_add' onClick={fetchDisks} disabled={loading}>
          <span>{loading ? t('disks.reading') : t('disks.readNow')}</span>
        </button>
      </div>

      <div className='Servers_collapse_body'>
        <div className='Servers_collapse_inner'>
          {error && <p className='Disks_error'>{error}</p>}
          {nodeDisks?.error && <p className='Disks_error'>{nodeDisks.error}</p>}

          {nodeDisks && !nodeDisks.error && (
            <div className='Servers_table_wrap'>
              <table className='Servers_table Disks_table'>
                <thead>
                  <tr>
                    {COLUMNS.map((column) => (
                      <th key={column}>{t(`disks.col.${column}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {disks.map((disk) => (
                    <Disk_Row key={disk.key} disk={disk} />
                  ))}
                  {disks.length === 0 && (
                    <tr>
                      <td colSpan={COLUMNS.length} className='Servers_table_empty'>
                        {t('disks.none')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {pools.length > 0 && (
            <div className='Disks_pools'>
              <span className='Servers_card_label'>{t('disks.pools')}</span>
              {pools.map((pool) => (
                <div key={pool.name} className={`Disks_pool ${pool.status}`}>
                  <i className={`Disks_dot ${pool.status}`} />
                  <span className='Disks_pool_name'>{pool.name}</span>
                  <span className='Disks_pool_health'>{pool.health}</span>
                  <span className='mono'>
                    {formatBytes(pool.alloc)} / {formatBytes(pool.size)} · {formatPercent(ratio(pool.alloc, pool.size))}
                  </span>
                  {pool.issues.map((issue) => (
                    <span key={issue.text} className={`Disks_issue ${issue.level}`}>{issue.text}</span>
                  ))}
                </div>
              ))}
            </div>
          )}

          <span className='Disks_hint'>{t('disks.hint')}</span>
        </div>
      </div>
    </section>
  );
};

export default Disks_Table;
