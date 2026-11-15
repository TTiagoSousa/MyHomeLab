import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ServerDashboard } from '../../../Hooks/Servers/useServerDashboard';
import { formatBytes, formatPercent, formatUptime, ratio, usageLevel } from './format';
import Guests_Table from './Guests_Table';
import Service_Monitors from './Service_Monitors';
import Disks_Table from './Disks_Table';

interface Meter_Props {
  label: string;
  fraction: number;
  detail: string;
}

const Meter = ({ label, fraction, detail }: Meter_Props) => {
  const width = Math.min(Math.max(fraction, 0), 1) * 100;

  return (
    <div className='Servers_meter'>
      <div className='Servers_meter_head'>
        <span className='Servers_meter_label'>{label}</span>
        <span className={`Servers_meter_value ${usageLevel(fraction)}`}>{formatPercent(fraction)}</span>
      </div>
      <div className='Servers_meter_track'>
        <i className={usageLevel(fraction)} style={{ width: `${width}%` }} />
      </div>
      <span className='Servers_meter_detail'>{detail}</span>
    </div>
  );
};

interface Server_View_Props {
  serverId: string;
  dashboard: ServerDashboard;
}

const Server_View = ({ serverId, dashboard }: Server_View_Props) => {
  const { t } = useTranslation('servers');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const nodes = dashboard.nodes ?? [];
  const node =
    nodes.find((entry) => entry.name === selectedNode) ??
    nodes.find((entry) => entry.status === 'online') ??
    nodes[0];

  if (!node) return <div className='Servers_empty'>{t('noNodes')}</div>;

  const isCluster = nodes.length > 1;
  const belongsToNode = (item: { node: string }) => !isCluster || item.node === node.name;

  const guests = (dashboard.guests ?? []).filter(belongsToNode);
  const runningGuests = guests.filter((guest) => guest.status === 'running');
  const storages = (dashboard.storages ?? [])
    .filter((storage) => belongsToNode(storage) && storage.total > 0)
    .sort((a, b) => b.total - a.total);

  const loadAverage = node.loadavg?.length ? node.loadavg.map((value) => value.toFixed(2)).join(' · ') : '—';
  const swap = node.swapTotal ? `${formatBytes(node.swapUsed)} / ${formatBytes(node.swapTotal)}` : '—';

  return (
    <div className='Servers_view'>
      {isCluster && (
        <div className='Servers_nodes'>
          {nodes.map((entry) => (
            <button
              key={entry.name}
              type='button'
              className={entry.name === node.name ? 'active' : ''}
              onClick={() => setSelectedNode(entry.name)}
            >
              <i className={`Servers_dot ${entry.status === 'online' ? 'on' : 'off'}`} />
              {entry.name}
            </button>
          ))}
        </div>
      )}

      <section className='Servers_grid'>
        <div className='Servers_card'>
          <span className='Servers_card_label'>{t('kpi.node', { name: node.name })}</span>
          <Meter
            label={t('kpi.cpu')}
            fraction={node.cpu}
            detail={t('kpi.cores', { count: node.cpus })}
          />
          <Meter
            label={t('kpi.memory')}
            fraction={ratio(node.memUsed, node.memTotal)}
            detail={`${formatBytes(node.memUsed)} / ${formatBytes(node.memTotal)}`}
          />
          <Meter
            label={t('kpi.rootDisk')}
            fraction={ratio(node.rootUsed, node.rootTotal)}
            detail={`${formatBytes(node.rootUsed)} / ${formatBytes(node.rootTotal)}`}
          />
        </div>

        <div className='Servers_card'>
          <span className='Servers_card_label'>{t('kpi.details')}</span>
          <dl className='Servers_facts'>
            <dt>{t('kpi.machines')}</dt>
            <dd>{t('kpi.machinesValue', { running: runningGuests.length, total: guests.length })}</dd>
            <dt>{t('kpi.uptime')}</dt>
            <dd>{formatUptime(node.uptime)}</dd>
            <dt>{t('kpi.load')}</dt>
            <dd>{loadAverage}</dd>
            <dt>{t('kpi.swap')}</dt>
            <dd>{swap}</dd>
            <dt>{t('kpi.version')}</dt>
            <dd>Proxmox {dashboard.version}</dd>
            {node.cpuModel && (
              <>
                <dt>{t('kpi.cpuModel')}</dt>
                <dd>{node.cpuModel}</dd>
              </>
            )}
          </dl>
        </div>

        <div className='Servers_card'>
          <span className='Servers_card_label'>{t('storage.title')}</span>
          {storages.length === 0 && <p className='Servers_card_empty'>{t('storage.empty')}</p>}
          {storages.map((storage) => (
            <Meter
              key={`${storage.node}-${storage.name}`}
              label={storage.name}
              fraction={ratio(storage.used, storage.total)}
              detail={`${formatBytes(storage.used)} / ${formatBytes(storage.total)} · ${storage.type}`}
            />
          ))}
        </div>
      </section>

      <Service_Monitors />

      <Guests_Table guests={guests} />

      <Disks_Table serverId={serverId} node={node.name} />
    </div>
  );
};

export default Server_View;
