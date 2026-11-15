import {
  ProxmoxClient,
  ProxmoxResource,
  RrdTimeframe,
} from 'src/proxmox/proxmox.client';

export interface DashboardNode {
  name: string;
  status: string;
  cpu: number; // fração 0–1
  cpus: number;
  cpuModel: string | null;
  memUsed: number;
  memTotal: number;
  swapUsed: number;
  swapTotal: number;
  rootUsed: number;
  rootTotal: number;
  uptime: number; // segundos
  loadavg: number[];
  kernel: string | null;
}

export interface DashboardStorage {
  name: string;
  node: string;
  type: string;
  used: number;
  total: number;
  active: boolean;
  shared: boolean;
  content: string[];
}

export interface DashboardGuest {
  vmid: number;
  name: string;
  type: 'qemu' | 'lxc';
  node: string;
  status: string;
  cpu: number; // fração 0–1 dos vCPUs da máquina
  cpus: number;
  memUsed: number;
  memTotal: number;
  diskUsed: number;
  diskTotal: number;
  netIn: number; // bytes desde o arranque
  netOut: number;
  uptime: number;
}

export interface DashboardPoint {
  t: number; // epoch em segundos
  cpu: number | null;
  memUsed: number | null;
  memTotal: number | null;
  netIn: number | null; // bytes/s
  netOut: number | null;
  load: number | null;
  iowait: number | null;
}

export interface ServerDashboard {
  version: string;
  timeframe: RrdTimeframe;
  fetchedAt: string;
  nodes: DashboardNode[];
  storages: DashboardStorage[];
  guests: DashboardGuest[];
  /** Histórico por nó, para os gráficos. */
  history: Record<string, DashboardPoint[]>;
}

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * Tudo o que o dashboard de um servidor mostra, numa resposta só: os nós com o
 * detalhe de /nodes/{node}/status, os storages e as máquinas de /cluster/resources
 * (uma chamada para tudo) e o histórico de cada nó (rrddata).
 *
 * Um nó desligado num cluster não estraga o resto: aparece com o estado que o
 * cluster lhe dá e sem histórico.
 */
export async function buildServerDashboard(
  client: ProxmoxClient,
  timeframe: RrdTimeframe,
): Promise<ServerDashboard> {
  const [version, resources] = await Promise.all([
    client.version(),
    client.clusterResources(),
  ]);

  const byType = (type: string) =>
    resources.filter((resource) => resource.type === type);
  const nodeResources = byType('node');

  const nodes = await Promise.all(
    nodeResources.map(async (resource): Promise<DashboardNode> => {
      const name = resource.node ?? resource.id.replace(/^node\//, '');
      const base: DashboardNode = {
        name,
        status: resource.status ?? 'unknown',
        cpu: resource.cpu ?? 0,
        cpus: resource.maxcpu ?? 0,
        cpuModel: null,
        memUsed: resource.mem ?? 0,
        memTotal: resource.maxmem ?? 0,
        swapUsed: 0,
        swapTotal: 0,
        rootUsed: resource.disk ?? 0,
        rootTotal: resource.maxdisk ?? 0,
        uptime: resource.uptime ?? 0,
        loadavg: [],
        kernel: null,
      };
      if (resource.status !== 'online') return base;

      try {
        const status = await client.nodeStatus(name);
        return {
          ...base,
          cpu: status.cpu,
          cpus: status.cpuinfo?.cpus ?? base.cpus,
          cpuModel: status.cpuinfo?.model ?? null,
          memUsed: status.memory.used,
          memTotal: status.memory.total,
          swapUsed: status.swap?.used ?? 0,
          swapTotal: status.swap?.total ?? 0,
          rootUsed: status.rootfs?.used ?? base.rootUsed,
          rootTotal: status.rootfs?.total ?? base.rootTotal,
          uptime: status.uptime,
          loadavg: (status.loadavg ?? []).map(Number),
          kernel: status.kversion ?? null,
        };
      } catch {
        return base;
      }
    }),
  );

  const historyEntries = await Promise.all(
    nodes
      .filter((node) => node.status === 'online')
      .map(async (node) => {
        try {
          const points = await client.nodeHistory(node.name, timeframe);
          return [
            node.name,
            points
              .filter((point) => typeof point.time === 'number')
              .map((point): DashboardPoint => ({
                t: point.time,
                cpu: num(point.cpu),
                memUsed: num(point.memused),
                memTotal: num(point.memtotal),
                netIn: num(point.netin),
                netOut: num(point.netout),
                load: num(point.loadavg),
                iowait: num(point.iowait),
              })),
          ] as const;
        } catch {
          return [node.name, []] as const;
        }
      }),
  );

  const history: Record<string, DashboardPoint[]> = {};
  for (const [name, points] of historyEntries) history[name] = [...points];

  const storages = byType('storage').map(
    (resource: ProxmoxResource): DashboardStorage => ({
      name: resource.storage ?? resource.id,
      node: resource.node ?? '',
      type: resource.plugintype ?? '',
      used: resource.disk ?? 0,
      total: resource.maxdisk ?? 0,
      active: resource.status === 'available',
      shared: resource.shared === 1,
      content: (resource.content ?? '').split(',').filter(Boolean),
    }),
  );

  const guests = resources
    .filter(
      (resource) =>
        (resource.type === 'qemu' || resource.type === 'lxc') &&
        resource.template !== 1,
    )
    .map((resource): DashboardGuest => ({
      vmid: resource.vmid ?? 0,
      name: resource.name ?? String(resource.vmid ?? resource.id),
      type: resource.type as 'qemu' | 'lxc',
      node: resource.node ?? '',
      status: resource.status ?? 'unknown',
      cpu: resource.cpu ?? 0,
      cpus: resource.maxcpu ?? 0,
      memUsed: resource.mem ?? 0,
      memTotal: resource.maxmem ?? 0,
      diskUsed: resource.disk ?? 0,
      diskTotal: resource.maxdisk ?? 0,
      netIn: resource.netin ?? 0,
      netOut: resource.netout ?? 0,
      uptime: resource.uptime ?? 0,
    }))
    .sort((a, b) => a.vmid - b.vmid);

  return {
    version: version.version,
    timeframe,
    fetchedAt: new Date().toISOString(),
    nodes,
    storages,
    guests,
    history,
  };
}
